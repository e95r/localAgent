import type { Page } from 'playwright';
import type { SiteProfile } from '../profiles/site-profile.js';

export interface BannerDetection {
  detected: boolean;
  selector?: string;
  action: 'accept' | 'close' | 'none';
  ambiguous: boolean;
  reason: string;
}

const SAFE_LABELS = ['accept', 'i agree', 'continue', 'close', 'skip'];
const AMBIGUOUS_LABELS = ['submit', 'confirm', 'allow all', 'delete'];

export class ConsentBannerResolver {
  async detect(page: Page, profile: SiteProfile): Promise<BannerDetection> {
    const selectors = [...profile.consentSelectors, ...profile.modalCloseSelectors];

    for (const selector of selectors) {
      const loc = page.locator(selector).first();
      if (!(await loc.count())) continue;
      if (!(await loc.isVisible().catch(() => false))) continue;
      const text = ((await loc.textContent().catch(() => '')) ?? '').trim().toLowerCase();
      const label = text || selector.toLowerCase();
      const ambiguous = AMBIGUOUS_LABELS.some((token) => label.includes(token));
      const safe = SAFE_LABELS.some((token) => label.includes(token)) || selector.includes('accept') || selector.includes('close');
      return {
        detected: true,
        selector,
        action: selector.includes('close') || label.includes('close') || label.includes('skip') ? 'close' : 'accept',
        ambiguous: ambiguous || !safe,
        reason: ambiguous ? 'ambiguous-banner-control' : 'likely-safe-consent-control',
      };
    }

    return { detected: false, action: 'none', ambiguous: false, reason: 'no-banner-detected' };
  }

  async handleIfSafe(page: Page, profile: SiteProfile, autoConsent: boolean): Promise<BannerDetection> {
    const detection = await this.detect(page, profile);
    if (!detection.detected) return detection;
    if (!autoConsent || detection.ambiguous || !detection.selector) return detection;
    await page.locator(detection.selector).first().click();
    return detection;
  }
}
