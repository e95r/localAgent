import type { Page } from 'playwright';

export class SpinnerLoadingDetector {
  async hasActiveLoading(page: Page, selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (await loc.count()) {
        if (await loc.isVisible().catch(() => false)) return true;
      }
    }
    return false;
  }
}
