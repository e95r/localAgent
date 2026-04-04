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

    const visibleText = normalizeText(await page.evaluate(() => document.body?.innerText ?? ''));

    const interactiveElements = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('a, button, input, textarea, main, article, body, [role], dialog, .modal, .overlay'));

      return candidates.map((el, index) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        const role = el.getAttribute('role');
        const tag = el.tagName.toLowerCase();
        const isInput = tag === 'input' || tag === 'textarea';
        const clickable = tag === 'a' || tag === 'button' || role === 'button' || role === 'link';
        const classText = element.className?.toString().toLowerCase() ?? '';
        const isOverlay = role === 'dialog' || tag === 'dialog' || classText.includes('modal') || classText.includes('overlay');
        const elementType: 'button' | 'link' | 'input' | 'textarea' | 'dialog' | 'modal' | 'container' =
          isOverlay ? 'modal' : clickable ? (tag === 'a' || role === 'link' ? 'link' : 'button') : isInput ? (tag === 'textarea' ? 'textarea' : 'input') : 'container';
        const id = `el-${index}`;
        const selectorHint = element.id ? `#${element.id}` : `${tag}:nth-of-type(${index + 1})`;
        const text = (element.innerText || (el as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
        const nearest = element.closest('section,article,main,form,div')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? '';
        return {
          id,
          tag,
          role,
          elementType,
          text,
          ariaLabel: el.getAttribute('aria-label'),
          placeholder: (el as HTMLInputElement).placeholder ?? null,
          href: (el as HTMLAnchorElement).getAttribute?.('href') ?? null,
          value: (el as HTMLInputElement).value ?? null,
          visible,
          enabled: !(el as HTMLButtonElement).disabled,
          clickable,
          boundingBox: visible ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          selectorHint,
          nearestTextContext: nearest,
          containerHint: element.closest('[role],main,article,section,form,div')?.tagName.toLowerCase() ?? null,
          isLikelyOverlay: isOverlay,
          isLikelyPrimaryAction: clickable && /download|search|submit|continue|accept/i.test(`${text} ${el.getAttribute('aria-label') ?? ''}`),
          domSnippet: element.outerHTML.slice(0, 220),
        };
      });
    });

    return normalizePageState({ url, title: normalizeText(title), visibleText, interactiveElements });
  }
}
