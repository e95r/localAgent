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
    if (mode === 'adaptive' && target.preferOrganic) {
      const ranked = await this.resolveRankedSearchResult(page, target);
      if (ranked) return ranked;
    }

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

  private async resolveRankedSearchResult(page: Page, target: RecordedTargetSnapshot): Promise<ReplayResolutionResult | null> {
    if (!target.preferOrganic) return null;

    const links = page.locator('a[href]');
    const count = await links.count();
    if (!count) return null;

    const keyword = (target.targetKeyword ?? target.text ?? '').toLowerCase().trim();
    const domain = (target.targetDomain ?? target.href ?? '').toLowerCase().trim();

    const scored: Array<{ index: number; score: number; href: string; text: string; sponsored: boolean }> = [];

    for (let index = 0; index < count; index += 1) {
      const locator = links.nth(index);
      const candidate = await locator.evaluate((el) => {
        const anchor = el as HTMLAnchorElement;
        const text = (anchor.innerText ?? anchor.textContent ?? '').replace(/\s+/g, ' ').trim();
        const href = anchor.getAttribute('href') ?? anchor.href ?? '';
        const context = (anchor.closest('article,li,section,div')?.textContent ?? '').replace(/\s+/g, ' ').toLowerCase();
        const attrs = `${anchor.getAttribute('aria-label') ?? ''} ${anchor.className ?? ''} ${anchor.id ?? ''}`.toLowerCase();
        const sponsored =
          anchor.closest('[data-sponsored],[data-ad],.sponsored,.ad-result,[aria-label*="sponsored" i]') !== null ||
          /\bsponsored\b/.test(context) ||
          /\bad\b/.test(attrs);
        return { text, href, sponsored };
      });

      const textLower = candidate.text.toLowerCase();
      const hrefLower = candidate.href.toLowerCase();
      let score = 0;
      if (domain && hrefLower.includes(domain)) score += 8;
      if (keyword && hrefLower.includes(keyword)) score += 4;
      if (keyword && textLower.includes(keyword)) score += 5;
      if (target.text && textLower.includes(target.text.toLowerCase())) score += 2;
      scored.push({ index, score, href: candidate.href, text: candidate.text, sponsored: candidate.sponsored });
    }

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    if (!scored.length) return null;

    const bestScore = scored[0].score;
    const topCandidates = scored.filter((candidate) => candidate.score === bestScore);
    const bestTop = topCandidates[0];

    const describe = (candidate: { href: string; score: number; sponsored: boolean }) =>
      `href=${candidate.href || '(empty)'}, score=${candidate.score}, sponsored=${candidate.sponsored}`;

    let best = bestTop;

    if (best.score < 5) {
      return {
        confidence: 0.3,
        reason: `No confident organic search result candidate; top=${describe(best)}`,
        strategy: 'ask-user',
        candidates: scored.slice(0, 5).map((c) => ({ selector: `a[href]@${c.index}`, score: c.score })),
      };
    }

    if (topCandidates.length > 1) {
      const topOrganicDomainMatch = topCandidates.find((candidate) => !candidate.sponsored && domain && candidate.href.toLowerCase().includes(domain));
      if (!topOrganicDomainMatch) {
        return {
          confidence: 0.45,
          reason: `Ambiguous top-ranked search results; top=${topCandidates.map((candidate) => describe(candidate)).join(' | ')}`,
          strategy: 'ask-user',
          candidates: scored.slice(0, 5).map((c) => ({ selector: `a[href]@${c.index}`, score: c.score })),
        };
      }
      best = topOrganicDomainMatch;
    }

    const bestOrganic = scored.find((candidate) => !candidate.sponsored);
    const organicCloseScoreGap = 6;
    if (best.sponsored && bestOrganic && bestOrganic.score >= best.score - organicCloseScoreGap) {
      best = bestOrganic;
    }

    const second = scored[1];
    if (second && second.score === best.score && second.index !== best.index) {
      return {
        confidence: 0.45,
        reason: `Ambiguous top-ranked search results; selected=${describe(best)}; rival=${describe(second)}`,
        strategy: 'ask-user',
        candidates: scored.slice(0, 5).map((c) => ({ selector: `a[href]@${c.index}`, score: c.score })),
      };
    }

    return {
      locator: links.nth(best.index),
      confidence: best.sponsored ? 0.5 : 0.88,
      reason: best.sponsored
        ? `Best candidate found but marked sponsored; selected=${describe(best)}`
        : `Ranked organic search result matched; selected=${describe(best)}`,
      strategy: 'semantic-match',
      candidates: scored.slice(0, 5).map((c) => ({ selector: `a[href]@${c.index}`, score: c.score })),
    };
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
