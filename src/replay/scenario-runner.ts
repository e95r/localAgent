import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserExecutor } from '../executor/browser-executor.js';
import type { PageObserver } from '../observer/page-observer.js';
import type { ActionValidator } from '../validator/action-validator.js';
import type { AgentAction } from '../types/actions.js';
import type { ReplayMode, ReplayResult, ReplayStepResult, Scenario } from '../scenario/types.js';
import { ReplayTargetResolver } from './target-resolver.js';
import { verifyPostStepExpectation } from './post-step-verifier.js';

export interface ScenarioRunnerOptions {
  mode: ReplayMode;
  maxRetriesPerStep?: number;
  debugArtifacts?: { enabled: boolean; outputDir: string };
  plannerAssistedResolver?: (ctx: { scenario: Scenario; stepIndex: number; pageUrl: string }) => Promise<string | null>;
}

export class ScenarioRunner {
  private readonly resolver = new ReplayTargetResolver();

  constructor(private readonly deps: { executor: BrowserExecutor; observer: PageObserver; validator: ActionValidator }) {}

  async runScenario(scenario: Scenario, options: ScenarioRunnerOptions): Promise<ReplayResult> {
    const results: ReplayStepResult[] = [];
    const maxRetries = options.maxRetriesPerStep ?? 1;

    await this.deps.executor.openUrl(scenario.metadata.startUrl);

    for (let index = 0; index < scenario.steps.length; index += 1) {
      const step = scenario.steps[index];
      let attempts = 0;
      let done = false;

      while (!done && attempts <= maxRetries) {
        attempts += 1;
        try {
          const state = await this.deps.observer.collect(this.deps.executor.getPage());
          const beforeUrl = state.url;

          if (step.action.actionType === 'open_url') {
            await this.deps.executor.openUrl(step.action.value ?? scenario.metadata.startUrl);
            const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation);
            results.push({ stepId: step.stepId, actionType: step.action.actionType, success: expectedCheck.passed, strategy: 'strict-selector', confidence: 1, reason: 'URL opened', expectedCheck });
            done = true;
            continue;
          }

          if (step.action.actionType === 'wait_for') {
            if (step.action.value) await this.deps.executor.waitForElement(step.action.value);
            const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation);
            results.push({ stepId: step.stepId, actionType: step.action.actionType, success: expectedCheck.passed, strategy: 'strict-selector', confidence: 1, reason: 'Wait complete', expectedCheck });
            done = true;
            continue;
          }

          if (step.action.actionType === 'finish') {
            results.push({ stepId: step.stepId, actionType: step.action.actionType, success: true, strategy: 'strict-selector', confidence: 1, reason: step.action.value ?? 'Finished' });
            done = true;
            continue;
          }

          if (!step.target) throw new Error('Step target is missing');
          let resolution = await this.resolver.resolve(this.deps.executor.getPage(), step.target, options.mode);

          if (!resolution.locator && options.mode === 'adaptive' && options.plannerAssistedResolver) {
            const plannerSelector = await options.plannerAssistedResolver({ scenario, stepIndex: index, pageUrl: await this.deps.executor.getCurrentUrl() });
            if (plannerSelector) {
              const plannerLocator = this.deps.executor.getPage().locator(plannerSelector).first();
              if (await plannerLocator.count()) {
                resolution = { locator: plannerLocator, confidence: 0.7, reason: 'Resolved by planner-assisted fallback', strategy: 'planner-assisted' };
              }
            }
          }

          if (!resolution.locator || resolution.confidence < 0.5) {
            const askResult: ReplayStepResult = {
              stepId: step.stepId,
              actionType: step.action.actionType,
              success: false,
              strategy: 'ask-user',
              confidence: resolution.confidence,
              reason: resolution.reason,
              askUserQuestion: 'Не удалось надёжно сопоставить элемент. Нужна помощь пользователя.',
            };
            results.push(askResult);
            await this.persistArtifacts(options, scenario, results, askResult, resolution);
            return this.finish(options.mode, results);
          }

          const targetId = await resolution.locator.evaluate((el) => el.getAttribute('data-agent-id') ?? '');
          const mappedAction = this.toAgentAction(step.action.actionType, targetId, step.action.value, step.action.mode);
          this.deps.validator.validate(mappedAction, state);

          let extractedText = '';
          let downloadsCount = 0;
          if (step.action.actionType === 'click') {
            await resolution.locator.click();
            await this.deps.executor.waitForPageSettled(beforeUrl);
          } else if (step.action.actionType === 'type') {
            await resolution.locator.fill(step.action.value ?? '');
          } else if (step.action.actionType === 'submit_search') {
            if (step.action.mode === 'enter') await resolution.locator.press('Enter');
            else await resolution.locator.click();
            await this.deps.executor.waitForPageSettled(beforeUrl);
          } else if (step.action.actionType === 'extract_text') {
            extractedText = await resolution.locator.textContent() ?? '';
          }

          if (step.postActionExpectation?.fileDownloadExpected && step.action.actionType === 'click') {
            downloadsCount = 1;
          }

          const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation, extractedText, downloadsCount);
          const stepResult: ReplayStepResult = {
            stepId: step.stepId,
            actionType: step.action.actionType,
            success: expectedCheck.passed,
            strategy: resolution.strategy,
            confidence: resolution.confidence,
            reason: resolution.reason,
            extractedText,
            expectedCheck,
          };

          if (!expectedCheck.passed && options.mode === 'adaptive' && attempts <= maxRetries) continue;

          results.push(stepResult);
          if (!expectedCheck.passed) {
            await this.persistArtifacts(options, scenario, results, stepResult, resolution);
            return this.finish(options.mode, results);
          }
          done = true;
        } catch (error) {
          if (attempts > maxRetries) {
            const failed: ReplayStepResult = {
              stepId: step.stepId,
              actionType: step.action.actionType,
              success: false,
              strategy: 'ask-user',
              confidence: 0,
              reason: 'Replay execution failed',
              error: error instanceof Error ? error.message : String(error),
            };
            results.push(failed);
            await this.persistArtifacts(options, scenario, results, failed);
            return this.finish(options.mode, results);
          }
        }
      }
    }

    return this.finish(options.mode, results);
  }

  private toAgentAction(type: ReplayStepResult['actionType'], targetId: string, value?: string, mode?: 'button' | 'enter'): AgentAction {
    if (type === 'click') return { type: 'click', targetId, plannerSource: 'rule-based' };
    if (type === 'type') return { type: 'type', targetId, text: value ?? '', plannerSource: 'rule-based' };
    if (type === 'extract_text') return { type: 'extract_text', targetId, plannerSource: 'rule-based' };
    if (type === 'submit_search') return { type: 'submit_search', targetId, mode: mode ?? 'enter', plannerSource: 'rule-based' };
    return { type: 'ask_user', question: 'unsupported', plannerSource: 'hybrid-ask-user' };
  }

  private finish(mode: ReplayMode, steps: ReplayStepResult[]): ReplayResult {
    return {
      mode,
      success: steps.every((step) => step.success),
      finishedAt: new Date().toISOString(),
      steps,
    };
  }

  private async persistArtifacts(
    options: ScenarioRunnerOptions,
    scenario: Scenario,
    stepResults: ReplayStepResult[],
    failure: ReplayStepResult,
    resolution?: unknown,
  ): Promise<void> {
    if (!options.debugArtifacts?.enabled) return;
    const dir = path.join(options.debugArtifacts.outputDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-replay-failure`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'scenario.json'), JSON.stringify(scenario, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-mode.json'), JSON.stringify({ mode: options.mode }, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-step-results.json'), JSON.stringify(stepResults, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'target-resolution.json'), JSON.stringify(resolution ?? {}, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-failure-reason.txt'), `${failure.reason}${failure.error ? `\n${failure.error}` : ''}`, 'utf-8');
    await writeFile(path.join(dir, 'expected-vs-actual.json'), JSON.stringify(failure.expectedCheck ?? {}, null, 2), 'utf-8');
  }
}

export async function runScenario(
  deps: ConstructorParameters<typeof ScenarioRunner>[0],
  scenario: Scenario,
  options: ScenarioRunnerOptions,
): Promise<ReplayResult> {
  return new ScenarioRunner(deps).runScenario(scenario, options);
}
