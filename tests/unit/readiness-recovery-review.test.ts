import { describe, expect, it } from 'vitest';
import { PageReadinessEvaluator } from '../../src/readiness/page-readiness-evaluator.js';
import { ReplayRecoveryPolicy } from '../../src/recovery/retry-policy.js';
import { formatReviewSummary } from '../../src/review/review-summary.js';

describe('readiness/recovery/review', () => {
  it('waits for delayed content readiness', async () => {
    let checks = 0;
    const page = {
      locator: () => ({
        first: () => ({
          count: async () => 1,
          isVisible: async () => {
            checks += 1;
            return checks < 3;
          },
        }),
      }),
      waitForTimeout: async () => {},
    } as any;
    const evaluator = new PageReadinessEvaluator();
    const result = await evaluator.waitUntilReady(page, {
      name: 'p', domainPattern: /.*/, consentSelectors: [], modalCloseSelectors: [], spinnerSelectors: ['.spinner'], riskyKeywords: [], preferredSelectors: [],
    }, 'stable');
    expect(result.ready).toBe(true);
    expect(result.attempts).toBeGreaterThan(1);
  });

  it('retry policy stops at max retries', () => {
    const policy = new ReplayRecoveryPolicy(2);
    expect(policy.decide(1, 'execution-error').shouldRetry).toBe(true);
    expect(policy.decide(2, 'execution-error').shouldRetry).toBe(false);
  });

  it('formats verbose review summary', () => {
    const text = formatReviewSummary({
      actionType: 'click',
      currentUrl: 'http://x',
      targetSummary: 'Delete account',
      reason: 'risky',
      confidence: 0.51,
      risk: 'high',
      source: 'planner-assisted',
      expectedOutcome: 'navigate',
    }, 'verbose');
    expect(text).toContain('Risk: high');
    expect(text).toContain('Source: planner-assisted');
  });
});
