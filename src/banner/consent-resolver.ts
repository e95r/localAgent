import type { Page } from 'playwright';
import type { SiteProfile } from '../profiles/site-profile.js';

export interface BannerDetection {
  detected: boolean;
  selector?: string;
  action: 'accept' | 'close' | 'none';
  ambiguous: boolean;
  reason: string;
  selectorScope?: 'page' | 'banner';
}

const SAFE_LABELS = ['accept', 'i agree', 'continue', 'close', 'skip'];
const AMBIGUOUS_LABELS = ['submit', 'confirm', 'allow all', 'delete'];
const BANNER_CONTAINER_SELECTOR = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  'dialog',
  '[data-consent]',
  '[data-modal]',
  '[data-banner]',
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[id*="newsletter" i]',
  '[class*="newsletter" i]',
  '[id*="modal" i]',
  '[class*="modal" i]',
  '[id*="overlay" i]',
  '[class*="overlay" i]',
].join(', ');

interface SelectorMatch {
  selector: string;
  label: string;
  scope: 'page' | 'banner';
}

export class ConsentBannerResolver {
  async detect(page: Page, profile: SiteProfile): Promise<BannerDetection> {
    const closeMatch = await this.findFirstVisibleMatch(page, profile.modalCloseSelectors, 'page');
    if (closeMatch) {
      return this.buildDetection(closeMatch.selector, closeMatch.label, closeMatch.scope);
    }

    const bannerVisible = await this.hasVisibleBannerContainer(page);
    const consentScope: 'banner' | 'page' = bannerVisible ? 'banner' : 'page';
    const consentMatch = await this.findFirstVisibleMatch(page, profile.consentSelectors, consentScope);
    if (!consentMatch) {
      return { detected: false, action: 'none', ambiguous: false, reason: 'no-banner-detected' };
    }
    return this.buildDetection(consentMatch.selector, consentMatch.label, consentMatch.scope);
  }

  async handleIfSafe(page: Page, profile: SiteProfile, autoConsent: boolean): Promise<BannerDetection> {
    const detection = await this.detect(page, profile);
    if (!detection.detected) return detection;
    if (!autoConsent || detection.ambiguous || !detection.selector) return detection;

    const root = detection.selectorScope === 'banner' ? page.locator(BANNER_CONTAINER_SELECTOR) : page;
    await root.locator(detection.selector).first().click();
    return detection;
  }

  private async hasVisibleBannerContainer(page: Page): Promise<boolean> {
    const containers = page.locator(BANNER_CONTAINER_SELECTOR);
    const count = await containers.count();
    for (let idx = 0; idx < count; idx += 1) {
      if (await containers.nth(idx).isVisible().catch(() => false)) return true;
    }
    return false;
  }

  private async findFirstVisibleMatch(page: Page, selectors: string[], scope: 'page' | 'banner'): Promise<SelectorMatch | undefined> {
    const roots = scope === 'banner' ? page.locator(BANNER_CONTAINER_SELECTOR) : page;
    for (const selector of selectors) {
      const loc = roots.locator(selector).first();
      if (!(await loc.count())) continue;
      if (!(await loc.isVisible().catch(() => false))) continue;
      const text = ((await loc.textContent().catch(() => '')) ?? '').trim().toLowerCase();
      const label = text || selector.toLowerCase();
      return { selector, label, scope };
    }
    return undefined;
  }

  private buildDetection(selector: string, label: string, selectorScope: 'page' | 'banner'): BannerDetection {
    const ambiguous = AMBIGUOUS_LABELS.some((token) => label.includes(token));
    const safe = SAFE_LABELS.some((token) => label.includes(token)) || selector.includes('accept') || selector.includes('close');
    return {
      detected: true,
      selector,
      selectorScope,
      action: selector.includes('close') || label.includes('close') || label.includes('skip') ? 'close' : 'accept',
      ambiguous: ambiguous || !safe,
      reason: ambiguous ? 'ambiguous-banner-control' : 'likely-safe-consent-control',
    };
  }
}
