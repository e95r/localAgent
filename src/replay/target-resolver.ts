import type { Locator, Page } from 'playwright';
import type { RecordedTargetSnapshot, ReplayMode, ResolutionStrategy } from '../scenario/types.js';

export interface ReplayResolutionResult {
  locator?: Locator;
  confidence: number;
  reason: string;
  strategy: ResolutionStrategy;
  candidates?: Array<{ selector: string; score: number }>;
}

export class ReplayTargetResolver {
  async resolve(page: Page, target: RecordedTargetSnapshot, mode: ReplayMode): Promise<ReplayResolutionResult> {
    const strict = await this.resolveStrict(page, target);
    if (strict.locator) return strict;
    if (mode === 'strict') return strict;

    const fallback = await this.resolveFallbackSelectors(page, target);
    if (fallback.locator) return fallback;

    return this.resolveSemantic(page, target);
  }

  async resolveStrict(page: Page, target: RecordedTargetSnapshot): Promise<ReplayResolutionResult> {
    for (const selector of target.strictSelectors) {
      if (!selector) continue;
      const locator = page.locator(selector).first();
      if (await locator.count()) return { locator, confidence: 1, reason: `Strict selector matched: ${selector}`, strategy: 'strict-selector' };
    }
    return { confidence: 0, reason: 'Strict selectors did not match', strategy: 'ask-user' };
  }

  private async resolveFallbackSelectors(page: Page, target: RecordedTargetSnapshot): Promise<ReplayResolutionResult> {
    for (const selector of target.fallbackSelectors) {
      if (!selector) continue;
      const locator = page.locator(selector).first();
      if (await locator.count()) return { locator, confidence: 0.8, reason: `Fallback selector matched: ${selector}`, strategy: 'fallback-selector' };
    }
    return { confidence: 0, reason: 'Fallback selectors did not match', strategy: 'ask-user' };
  }

  private async resolveSemantic(page: Page, target: RecordedTargetSnapshot): Promise<ReplayResolutionResult> {
    const handles = await page.locator('a, button, input, textarea, [role], main, article').elementHandles();
    const scored: Array<{ handle: any; score: number; selector: string }> = [];

    for (const handle of handles) {
      const score = await handle.evaluate((el, snapshot) => {
        const element = el as HTMLElement;
        const node = el as Element;
        const role = node.getAttribute('role');
        const text = ((element.innerText || (el as HTMLInputElement).value || '') ?? '').replace(/\s+/g, ' ').trim();
        let current = 0;
        if (snapshot.text && text && text.includes(snapshot.text)) current += 4;
        if (snapshot.ariaLabel && node.getAttribute('aria-label') === snapshot.ariaLabel) current += 3;
        if (snapshot.href && (el as HTMLAnchorElement).getAttribute?.('href') === snapshot.href) current += 3;
        if (snapshot.placeholder && (el as HTMLInputElement).placeholder === snapshot.placeholder) current += 2;
        if (snapshot.role && role === snapshot.role) current += 2;
        if (snapshot.tag && node.tagName.toLowerCase() === snapshot.tag) current += 2;
        const ctx = element.closest('section,article,main,form,div')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? '';
        if (snapshot.nearestTextContext && ctx.includes(snapshot.nearestTextContext.slice(0, 35))) current += 1;
        if (snapshot.containerHint && element.closest(snapshot.containerHint)) current += 1;
        return current;
      }, target);

      if (score > 0) {
        const selector = await handle.evaluate((el) => (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : (el as Element).tagName.toLowerCase());
        scored.push({ handle, score, selector });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    if (!scored.length) return { confidence: 0, reason: 'No semantic candidates found', strategy: 'ask-user', candidates: [] };

    const top = scored[0];
    const second = scored[1];
    if (second && second.score === top.score) {
      return {
        confidence: 0.45,
        reason: 'Ambiguous semantic match with equal candidates',
        strategy: 'ask-user',
        candidates: scored.slice(0, 5).map((item) => ({ selector: item.selector, score: item.score })),
      };
    }

    return {
      locator: page.locator(top.selector).first(),
      confidence: Math.min(0.95, top.score / 10),
      reason: `Semantic match resolved with score ${top.score}`,
      strategy: 'semantic-match',
      candidates: scored.slice(0, 5).map((item) => ({ selector: item.selector, score: item.score })),
    };
  }
}
