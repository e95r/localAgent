import type { PageState } from './page-state.js';

export type AgentAction =
  | { type: 'click'; targetId: string; reason?: string; confidence?: number }
  | { type: 'type'; targetId: string; text: string; reason?: string; confidence?: number }
  | { type: 'extract_text'; targetId: string; reason?: string; confidence?: number }
  | { type: 'ask_user'; question: string; reason?: string; confidence?: number }
  | { type: 'finish'; result: string; reason?: string; confidence?: number };

export interface PlannerInput {
  userGoal: string;
  pageState: PageState;
  actionHistory: AgentAction[];
}

export interface Planner {
  decide(input: PlannerInput): AgentAction;
}

export interface AgentStepResult {
  action: AgentAction;
  pageState: PageState;
  extractedText?: string;
}
