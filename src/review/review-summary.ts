import type { AgentAction } from '../types/actions.js';

export type ReviewMode = 'compact' | 'verbose';

export interface ReviewSummary {
  currentUrl: string;
  targetSummary: string;
  reason: string;
  confidence: number;
  expectedOutcome?: string;
  risk: 'safe' | 'medium' | 'high';
  source: 'profile-assisted' | 'planner-assisted' | 'llm-assisted' | 'replay';
  actionType: AgentAction['type'];
}

export function formatReviewSummary(summary: ReviewSummary, mode: ReviewMode): string {
  if (mode === 'compact') {
    return `${summary.actionType} ${summary.targetSummary} @ ${summary.currentUrl} [${summary.risk}]`;
  }

  return [
    `Action: ${summary.actionType}`,
    `URL: ${summary.currentUrl}`,
    `Target: ${summary.targetSummary}`,
    `Reason: ${summary.reason}`,
    `Confidence: ${summary.confidence.toFixed(2)}`,
    `Expected: ${summary.expectedOutcome ?? 'n/a'}`,
    `Risk: ${summary.risk}`,
    `Source: ${summary.source}`,
  ].join('\n');
}
