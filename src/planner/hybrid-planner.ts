import type { AgentAction, Planner, PlannerInput } from '../types/actions.js';
import { withPlannerConfig, type LlmPlannerConfig } from './planner-config.js';
import { RuleBasedPlanner } from './rule-based-planner.js';
import { LlmPlanner, type LlmPlannerTrace } from './llm-planner.js';

export class HybridPlanner implements Planner {
  constructor(
    private readonly ruleBasedPlanner: RuleBasedPlanner,
    private readonly llmPlanner: LlmPlanner,
    private readonly config: LlmPlannerConfig = withPlannerConfig(),
  ) {}


  getLastLlmTrace(): LlmPlannerTrace {
    return this.llmPlanner.getLastTrace();
  }

  async decide(input: PlannerInput): Promise<AgentAction> {
    const ruleAction = this.ruleBasedPlanner.decide(input);
    if (ruleAction.type !== 'ask_user' && (ruleAction.confidence ?? 0) >= this.config.ruleConfidenceThreshold) {
      return { ...ruleAction, plannerSource: 'rule-based' };
    }

    if (!this.config.enableLlmFallback) {
      return { ...ruleAction, plannerSource: 'rule-based' };
    }

    const llmAction = await this.llmPlanner.decide(input, ruleAction);
    if (llmAction.type === 'ask_user') return { ...llmAction, plannerSource: 'hybrid-ask-user' };
    if ((llmAction.confidence ?? 0) < this.config.llmConfidenceThreshold) {
      return {
        type: 'ask_user',
        question: 'Не хватает уверенности для безопасного действия. Уточните цель.',
        confidence: llmAction.confidence,
        reason: llmAction.reason,
        candidateTargets: llmAction.candidateTargets,
        selectedCapabilityName: llmAction.selectedCapabilityName,
        plannerSource: 'hybrid-ask-user',
      };
    }

    return { ...llmAction, plannerSource: 'llm' };
  }
}
