import type { ScenarioStep } from '../scenario/types.js';
import type { ApprovalMode, ApprovalRequest } from './approval-prompter.js';

const RISKY_TERMS = ['delete', 'remove', 'confirm', 'submit', 'merge', 'approve', 'publish', 'pay'];

export interface ApprovalEvaluationContext {
  step: ScenarioStep;
  confidence: number;
  strategy: string;
  currentUrl: string;
  source: string;
}

export interface ApprovalDecision {
  requiresApproval: boolean;
  reason: string;
  riskLevel: 'safe' | 'medium' | 'high';
  request: ApprovalRequest;
}

export class ApprovalPolicy {
  constructor(private readonly mode: ApprovalMode) {}

  evaluate(ctx: ApprovalEvaluationContext): ApprovalDecision {
    const risk = classifyStepRisk(ctx.step, ctx.confidence, ctx.strategy, ctx.currentUrl);
    const requiresApproval =
      this.mode === 'always' ||
      (this.mode === 'risky-only' && risk.riskLevel !== 'safe');

    return {
      requiresApproval,
      reason: risk.reason,
      riskLevel: risk.riskLevel,
      request: {
        stepId: ctx.step.stepId,
        actionType: ctx.step.action.actionType,
        targetSummary: summarizeTarget(ctx.step),
        reason: risk.reason,
        riskLevel: risk.riskLevel,
        confidence: ctx.confidence,
        source: ctx.source,
      },
    };
  }
}

export function summarizeTarget(step: ScenarioStep): string {
  if (!step.target) return 'no-target';
  return step.target.ariaLabel ?? step.target.text ?? step.target.selectorHint ?? step.target.strictSelectors[0] ?? 'unknown-target';
}

export function classifyStepRisk(step: ScenarioStep, confidence: number, strategy: string, currentUrl: string): { riskLevel: 'safe' | 'medium' | 'high'; reason: string } {
  const targetText = `${step.target?.text ?? ''} ${step.target?.ariaLabel ?? ''}`.toLowerCase();
  if (step.action.actionType === 'click' && RISKY_TERMS.some((term) => targetText.includes(term))) {
    return { riskLevel: 'high', reason: 'Target text suggests destructive/critical action' };
  }

  if (step.action.actionType === 'open_url') {
    const nextUrl = step.action.value ?? '';
    if (nextUrl && !nextUrl.startsWith(currentUrl) && !nextUrl.startsWith('/')) {
      return { riskLevel: 'high', reason: 'Navigation target URL is outside current origin or unknown' };
    }
  }

  if (confidence < 0.65) {
    return { riskLevel: 'medium', reason: 'Resolution confidence is below trusted threshold' };
  }

  if (strategy === 'planner-assisted') {
    return { riskLevel: 'medium', reason: 'Step resolved through planner-assisted fallback' };
  }

  return { riskLevel: 'safe', reason: 'No additional risk signals detected' };
}
