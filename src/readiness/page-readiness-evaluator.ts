import type { Page } from 'playwright';
import type { SiteProfile } from '../profiles/site-profile.js';
import { SpinnerLoadingDetector } from './loading-detector.js';
import { resolveWaitBudget, type WaitStrategy } from './wait-strategy.js';

export interface PageReadinessResult {
  ready: boolean;
  strategy: WaitStrategy;
  observedLoading: boolean;
  attempts: number;
}

export class PageReadinessEvaluator {
  constructor(private readonly detector = new SpinnerLoadingDetector()) {}

  async waitUntilReady(page: Page, profile: SiteProfile, strategy: WaitStrategy): Promise<PageReadinessResult> {
    const budget = resolveWaitBudget(strategy);
    const maxAttempts = Math.max(1, Math.floor(budget.settleTimeoutMs / budget.pollIntervalMs));
    let sawLoading = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const active = await this.detector.hasActiveLoading(page, profile.spinnerSelectors);
      sawLoading ||= active;
      if (!active) {
        return { ready: true, strategy, observedLoading: sawLoading, attempts: attempt };
      }
      await page.waitForTimeout(budget.pollIntervalMs);
    }

    return { ready: false, strategy, observedLoading: sawLoading, attempts: maxAttempts };
  }

  async waitForEnabled(page: Page, selector: string, strategy: WaitStrategy): Promise<boolean> {
    const budget = resolveWaitBudget(strategy);
    const maxAttempts = Math.max(1, Math.floor(budget.settleTimeoutMs / budget.pollIntervalMs));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const locator = page.locator(selector).first();
      if (await locator.count()) {
        const enabled = await locator.isEnabled().catch(() => false);
        if (enabled) return true;
      }
      await page.waitForTimeout(budget.pollIntervalMs);
    }

    return false;
  }
}
