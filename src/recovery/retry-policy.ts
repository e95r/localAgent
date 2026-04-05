export type RetryReason = 'stale-target' | 'readiness-timeout' | 'banner-blocking' | 'expectation-failed' | 'execution-error';

export interface RetryDecision {
  shouldRetry: boolean;
  reason: RetryReason;
  attempt: number;
  maxRetries: number;
}

export class ReplayRecoveryPolicy {
  constructor(private readonly maxRetries: number) {}

  decide(attempt: number, reason: RetryReason): RetryDecision {
    return {
      shouldRetry: attempt < this.maxRetries,
      reason,
      attempt,
      maxRetries: this.maxRetries,
    };
  }
}
