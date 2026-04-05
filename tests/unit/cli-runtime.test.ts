import { describe, expect, it } from 'vitest';
import { mapCliErrorToExitCode } from '../../src/cli/runtime.js';
import { formatApprovalPrompt } from '../../src/approval/console-approval-prompter.js';

describe('cli runtime helpers', () => {
  it('maps argument errors to exit code 2', () => {
    expect(mapCliErrorToExitCode(new Error('replay requires --file'))).toBe(2);
  });

  it('maps unknown runtime errors to exit code 1', () => {
    expect(mapCliErrorToExitCode(new Error('boom'))).toBe(1);
  });

  it('formats approval prompt text', () => {
    const text = formatApprovalPrompt({
      stepId: 'step-1',
      actionType: 'click',
      targetSummary: 'Delete',
      reason: 'Risky',
      riskLevel: 'high',
      confidence: 0.4,
      source: 'test',
    });
    expect(text).toContain('step=step-1');
    expect(text).toContain('risk=high');
  });
});
