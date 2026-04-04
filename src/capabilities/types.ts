import type { AgentAction } from '../types/actions.js';
import type { PageState } from '../types/page-state.js';

export interface CapabilityContext {
  userGoal: string;
  pageState: PageState;
  actionHistory: AgentAction[];
}

export interface CapabilityMatch {
  confidence: number;
  reason: string;
  candidateTargets?: string[];
}

export interface Capability {
  name: string;
  canHandle(context: CapabilityContext): CapabilityMatch | null;
  plan(context: CapabilityContext, match: CapabilityMatch): AgentAction;
}

export interface RankedCapability {
  capability: Capability;
  match: CapabilityMatch;
}

export interface CapabilityRegistry {
  rank(context: CapabilityContext): RankedCapability[];
}
