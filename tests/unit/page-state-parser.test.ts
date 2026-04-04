import { describe, expect, it } from 'vitest';
import { normalizePageState } from '../../src/observer/parse-page-state.js';

describe('normalizePageState', () => {
  it('normalizes title/text and trims snippets', () => {
    const state = normalizePageState({
      url: 'x',
      title: '  Hello   World ',
      visibleText: ' a\n  b ',
      interactiveElements: [
        {
          id: 'el-1',
          tag: 'button',
          role: null,
          text: ' Download   PDF ',
          ariaLabel: null,
          href: null,
          visible: true,
          enabled: true,
          boundingBox: null,
          selectorHint: '#a',
          domSnippet: '<button>' + 'x'.repeat(500) + '</button>',
        },
      ],
    });

    expect(state.title).toBe('Hello World');
    expect(state.visibleText).toBe('a b');
    expect(state.interactiveElements[0].text).toBe('Download PDF');
    expect(state.interactiveElements[0].domSnippet.length).toBeLessThanOrEqual(220);
  });

  it('keeps empty fields stable', () => {
    const state = normalizePageState({ url: 'x', title: '', visibleText: '', interactiveElements: [] });
    expect(state.title).toBe('');
    expect(state.interactiveElements).toEqual([]);
  });

  it('handles unicode safely', () => {
    const state = normalizePageState({
      url: 'x',
      title: 'Скачать   отчёт',
      visibleText: 'Привет\nмир',
      interactiveElements: [],
    });
    expect(state.title).toBe('Скачать отчёт');
  });
});
