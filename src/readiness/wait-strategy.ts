export type WaitStrategy = 'auto' | 'fast' | 'stable';

export interface WaitBudget {
  settleTimeoutMs: number;
  pollIntervalMs: number;
}

export function resolveWaitBudget(strategy: WaitStrategy): WaitBudget {
  if (strategy === 'fast') return { settleTimeoutMs: 300, pollIntervalMs: 50 };
  if (strategy === 'stable') return { settleTimeoutMs: 1800, pollIntervalMs: 120 };
  return { settleTimeoutMs: 900, pollIntervalMs: 80 };
}
