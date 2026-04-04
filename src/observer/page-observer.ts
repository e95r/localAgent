import type { Page } from 'playwright';
import type { PageState } from '../types/page-state.js';
import { normalizeText } from '../utils/text.js';
import { normalizePageState } from './parse-page-state.js';

export interface PageObserver {
  collect(page: Page): Promise<PageState>;
}

export class DOMPageObserver implements PageObserver {
  async collect(page: Page): Promise<PageState> {
    const url = page.url();
    const title = await page.title();

    const visibleText = normalizeText(
      await page.evaluate(() => document.body?.innerText ?? ''),
    );

    const interactiveElements = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('a, button, input, textarea, select, [role="button"], [role="link"]'),
      );

      return candidates.map((el, index) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0;

        const tag = el.tagName.toLowerCase();
        const id = `el-${index}`;
        const elementId = element.id ? `#${element.id}` : '';
        const selectorHint = elementId || `${tag}:nth-of-type(${index + 1})`;
        const text = (element.innerText || (el as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
        const html = element.outerHTML.slice(0, 220);

        return {
          id,
          tag,
          role: el.getAttribute('role'),
          text,
          ariaLabel: el.getAttribute('aria-label'),
          href: (el as HTMLAnchorElement).href ?? null,
          visible,
          enabled: !(el as HTMLButtonElement).disabled,
          boundingBox: visible
            ? {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
              }
            : null,
          selectorHint,
          domSnippet: html,
        };
      });
    });

    return normalizePageState({
      url,
      title: normalizeText(title),
      visibleText,
      interactiveElements,
    });
  }
}
