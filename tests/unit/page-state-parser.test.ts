import { describe, expect, it } from 'vitest';
import { normalizePageState } from '../../src/observer/parse-page-state.js';
import { makeElement } from './helpers.js';

describe('normalizePageState', () => {
  it('normalizes title/text and trims snippets', () => {
    const state = normalizePageState({
      url: 'x',
      title: '  Hello   World ',
      visibleText: ' a\n  b ',
      interactiveElements: [makeElement({ text: ' Download   PDF ', nearestTextContext: '  many    words  ', domSnippet: '<button>' + 'x'.repeat(500) + '</button>' })],
    });

    expect(state.title).toBe('Hello World');
    expect(state.visibleText).toBe('a b');
    expect(state.interactiveElements[0].text).toBe('Download PDF');
    expect(state.interactiveElements[0].nearestTextContext).toBe('many words');
    expect(state.interactiveElements[0].domSnippet.length).toBeLessThanOrEqual(220);
  });
});
