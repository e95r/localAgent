import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ConsoleApprovalPrompter } from '../../src/approval/console-approval-prompter.js';

describe('ConsoleApprovalPrompter', () => {
  it('consumes piped stdin answers and resolves reject deterministically', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const prompter = new ConsoleApprovalPrompter({ input, output });
    const promptPromise = prompter.prompt({
      stepId: 's1',
      actionType: 'open_url',
      targetSummary: 'https://example.com',
      riskLevel: 'high',
      reason: 'out-of-origin navigation',
      confidence: 1,
      source: 'scenario-runner',
    });
    input.write('n\n');
    const result = await promptPromise;
    expect(result.approved).toBe(false);
    expect(result.answer).toBe('rejected');
    expect(input.listenerCount('data')).toBe(0);
  });
});
