import type { AgentAction, AgentStepResult, Planner } from '../types/actions.js';
import type { BrowserExecutor } from '../executor/browser-executor.js';
import type { PageObserver } from '../observer/page-observer.js';
import type { ActionValidator } from '../validator/action-validator.js';
import { mapTargetIdToSelector } from '../utils/target-map.js';

export interface AgentDependencies {
  executor: BrowserExecutor;
  observer: PageObserver;
  planner: Planner;
  validator: ActionValidator;
}

export class BrowserAgent {
  private readonly history: AgentAction[] = [];

  constructor(private readonly deps: AgentDependencies) {}

  async run(userGoal: string, startUrl: string, maxSteps = 5): Promise<AgentStepResult[]> {
    const results: AgentStepResult[] = [];
    await this.deps.executor.openUrl(startUrl);

    for (let step = 0; step < maxSteps; step += 1) {
      const page = this.deps.executor.getPage();
      const state = await this.deps.observer.collect(page);
      const action = this.deps.planner.decide({
        userGoal,
        pageState: state,
        actionHistory: this.history,
      });

      this.deps.validator.validate(action, state);
      const stepResult: AgentStepResult = { action, pageState: state };

      if (action.type === 'click') {
        const selector = mapTargetIdToSelector(action.targetId, state.interactiveElements);
        await this.deps.executor.clickElement(selector);
      } else if (action.type === 'type') {
        const selector = mapTargetIdToSelector(action.targetId, state.interactiveElements);
        await this.deps.executor.typeText(selector, action.text);
      } else if (action.type === 'extract_text') {
        if (action.targetId === 'body') {
          stepResult.extractedText = await this.deps.executor.extractText('body');
        } else {
          const selector = mapTargetIdToSelector(action.targetId, state.interactiveElements);
          stepResult.extractedText = await this.deps.executor.extractText(selector);
        }
      }

      this.history.push(action);
      results.push(stepResult);

      if (action.type === 'finish' || action.type === 'ask_user') {
        break;
      }
    }

    return results;
  }
}
