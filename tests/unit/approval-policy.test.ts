import { describe, expect, it } from 'vitest';
import { ApprovalPolicy, classifyStepRisk } from '../../src/approval/approval-policy.js';
import type { ScenarioStep } from '../../src/scenario/types.js';

function step(actionType: ScenarioStep['action']['actionType'], text = 'Open'): ScenarioStep {
  return {
    stepId: 's1',
    action: { actionType },
    pageUrlAtRecordTime: 'http://127.0.0.1',
    target: { strictSelectors: ['#x'], fallbackSelectors: ['.x'], text },
  };
}

describe('approval policy', () => {
  it('risky action requires approval in risky-only mode', () => {
    const policy = new ApprovalPolicy('risky-only');
    const decision = policy.evaluate({ step: step('click', 'Delete item'), confidence: 0.9, strategy: 'strict-selector', currentUrl: 'http://127.0.0.1', source: 'test' });
    expect(decision.requiresApproval).toBe(true);
    expect(decision.riskLevel).toBe('high');
  });

  it('safe action skips approval in risky-only mode', () => {
    const policy = new ApprovalPolicy('risky-only');
    const decision = policy.evaluate({ step: step('click', 'Open docs'), confidence: 0.9, strategy: 'strict-selector', currentUrl: 'http://127.0.0.1', source: 'test' });
    expect(decision.requiresApproval).toBe(false);
  });

  it('always mode requires approval for safe action', () => {
    const policy = new ApprovalPolicy('always');
    const decision = policy.evaluate({ step: step('click', 'Open docs'), confidence: 0.9, strategy: 'strict-selector', currentUrl: 'http://127.0.0.1', source: 'test' });
    expect(decision.requiresApproval).toBe(true);
  });

  it('never mode skips all approvals', () => {
    const policy = new ApprovalPolicy('never');
    const decision = policy.evaluate({ step: step('click', 'Delete item'), confidence: 0.2, strategy: 'planner-assisted', currentUrl: 'http://127.0.0.1', source: 'test' });
    expect(decision.requiresApproval).toBe(false);
  });

  it('classifies low confidence as medium risk', () => {
    const risk = classifyStepRisk(step('click', 'Open'), 0.5, 'semantic-match', 'http://127.0.0.1');
    expect(risk.riskLevel).toBe('medium');
  });
});
