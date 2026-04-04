import type { PageState } from './page-state.js';

export type PlannerSource = 'rule-based' | 'llm' | 'hybrid-ask-user';

export interface DecisionMeta {
  confidence?: number;
  reason?: string;
  candidateTargets?: string[];
  selectedCapabilityName?: string;
  plannerSource?: PlannerSource;
}

export type AgentAction =
  | ({ type: 'click'; targetId: string } & DecisionMeta)
  | ({ type: 'type'; targetId: string; text: string } & DecisionMeta)
  | ({ type: 'extract_text'; targetId: string } & DecisionMeta)
  | ({ type: 'submit_search'; targetId: string; mode: 'button' | 'enter' } & DecisionMeta)
  | ({ type: 'ask_user'; question: string } & DecisionMeta)
  | ({ type: 'finish'; result: string } & DecisionMeta);

export interface PlannerInput {
  userGoal: string;
  pageState: PageState;
  actionHistory: AgentAction[];
}

export type MaybePromise<T> = T | Promise<T>;

export interface Planner {
  decide(input: PlannerInput): MaybePromise<AgentAction>;
}

export interface AgentStepResult {
  action: AgentAction;
  pageState: PageState;
  extractedText?: string;
}
