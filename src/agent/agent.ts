import type { AgentAction, AgentStepResult, Planner } from '../types/actions.js';
import type { BrowserExecutor } from '../executor/browser-executor.js';
import type { PageObserver } from '../observer/page-observer.js';
import type { ActionValidator } from '../validator/action-validator.js';
import { mapTargetIdToSelector } from '../utils/target-map.js';
import { writeDebugArtifacts, type ArtifactConfig } from '../debug/artifact-writer.js';
import type { LlmPlannerTrace } from '../planner/llm-planner.js';

export interface AgentDependencies {
  executor: BrowserExecutor;
  observer: PageObserver;
  planner: Planner;
  validator: ActionValidator;
  debugArtifacts?: ArtifactConfig;
}

export class BrowserAgent {
  private readonly history: AgentAction[] = [];

  constructor(private readonly deps: AgentDependencies) {}

  async run(userGoal: string, startUrl: string, maxSteps = 7): Promise<AgentStepResult[]> {
    const results: AgentStepResult[] = [];
    await this.deps.executor.openUrl(startUrl);

    for (let step = 0; step < maxSteps; step += 1) {
      const page = this.deps.executor.getPage();
      const state = await this.deps.observer.collect(page);
      const action = await this.deps.planner.decide({ userGoal, pageState: state, actionHistory: this.history });

      const repeated = this.history.at(-1)?.type === action.type && JSON.stringify(this.history.at(-1)) === JSON.stringify(action);
      if (repeated) {
        const askAction: AgentAction = {
          type: 'ask_user',
          question: 'Обнаружен цикл действий. Нужна дополнительная инструкция.',
          reason: 'Loop protection triggered',
          plannerSource: 'hybrid-ask-user',
        };
        results.push({ action: askAction, pageState: state });
        await this.persistArtifacts('loop', state, askAction, { ok: false, error: 'loop' });
        break;
      }

      try {
        this.deps.validator.validate(action, state);
      } catch (error) {
        const askAction: AgentAction = {
          type: 'ask_user',
          question: 'Предложенное действие небезопасно. Уточните цель.',
          reason: error instanceof Error ? error.message : String(error),
          plannerSource: 'hybrid-ask-user',
        };
        results.push({ action: askAction, pageState: state });
        await this.persistArtifacts('validator-rejection', state, action, { ok: false, error: askAction.reason });
        break;
      }

      const stepResult: AgentStepResult = { action, pageState: state };

      if (action.type === 'click') {
        await this.deps.executor.clickElement(mapTargetIdToSelector(action.targetId, state.interactiveElements));
      } else if (action.type === 'type') {
        await this.deps.executor.typeText(mapTargetIdToSelector(action.targetId, state.interactiveElements), action.text);
      } else if (action.type === 'submit_search') {
        const selector = mapTargetIdToSelector(action.targetId, state.interactiveElements);
        if (action.mode === 'button') await this.deps.executor.clickElement(selector);
        else await this.deps.executor.pressEnter(selector);
      } else if (action.type === 'extract_text') {
        stepResult.extractedText = await this.deps.executor.extractText(action.targetId === 'body' ? 'body' : mapTargetIdToSelector(action.targetId, state.interactiveElements));
      }

      this.history.push(action);
      results.push(stepResult);

      if (action.type === 'finish' || action.type === 'ask_user') {
        await this.persistArtifacts('ask-user', state, action, { ok: true });
        break;
      }
    }

    return results;
  }

  private getLlmTrace(): LlmPlannerTrace | undefined {
    const planner = this.deps.planner as Planner & { getLastLlmTrace?: () => LlmPlannerTrace; getLastTrace?: () => LlmPlannerTrace };
    return planner.getLastLlmTrace?.() ?? planner.getLastTrace?.();
  }

  private async persistArtifacts(reason: string, pageState: AgentStepResult['pageState'], plannerOutput: AgentAction, validatorResult: { ok: boolean; error?: string }): Promise<void> {
    const llmTrace = this.getLlmTrace();
    await writeDebugArtifacts({
      config: this.deps.debugArtifacts ?? { enabled: false, outputDir: 'debug-artifacts' },
      executor: this.deps.executor,
      pageState,
      plannerOutput,
      validatorResult,
      actionHistory: this.history,
      reason,
      llmArtifacts: llmTrace?.invoked
        ? {
            prompt: llmTrace.prompt,
            rawResponse: llmTrace.rawResponse,
            parsedResponse: llmTrace.parsedResponse,
          }
        : undefined,
    });
  }
}
