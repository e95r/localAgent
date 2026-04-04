import type { AgentAction, PlannerInput } from '../types/actions.js';
import type { InteractiveElement } from '../types/page-state.js';

export const LLM_ACTION_TYPES = ['click', 'type', 'extract_text', 'submit_search', 'ask_user', 'finish'] as const;
export type LlmActionType = (typeof LLM_ACTION_TYPES)[number];

export interface LlmPlannerOutput {
  selectedCapabilityName: string;
  action: LlmActionType;
  targetId?: string;
  text?: string;
  mode?: 'button' | 'enter';
  confidence: number;
  reason: string;
  candidateTargets: string[];
  warnings?: string[];
  question?: string;
  result?: string;
}

export interface LlmPlannerRequest {
  plannerInput: PlannerInput;
  prompt: string;
  candidateElements: InteractiveElement[];
  availableCapabilities: string[];
  plannerHint?: AgentAction;
  screenshotPath?: string;
  htmlPath?: string;
}

export interface LlmClient {
  generateAction(input: LlmPlannerRequest): Promise<string>;
}
