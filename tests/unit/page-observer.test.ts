import { describe, expect, it } from 'vitest';
import { DOMPageObserver } from '../../src/observer/page-observer.js';

describe('DOMPageObserver', () => {
  it('normalizes richer element payload', async () => {
    let evalCall = 0;
    const fakePage = {
      url: () => 'http://fake',
      title: async () => ' Test Page ',
      evaluate: async () => {
        evalCall += 1;
        if (evalCall === 1) return '  Visible   text ';
        return [
          {
            id: 'el-1', tag: 'button', role: null, elementType: 'button', text: ' Download ', ariaLabel: null,
            placeholder: null, href: null, value: null, visible: true, enabled: true, clickable: true,
            boundingBox: null, selectorHint: '#d', nearestTextContext: '  docs  ', containerHint: 'main',
            isLikelyOverlay: false, isLikelyPrimaryAction: true, domSnippet: '<button>' + 'x'.repeat(500) + '</button>',
          },
        ];
      },
    };

    const state = await new DOMPageObserver().collect(fakePage as any);
    expect(state.title).toBe('Test Page');
    expect(state.visibleText).toBe('Visible text');
    expect(state.interactiveElements[0].text).toBe('Download');
    expect(state.interactiveElements[0].domSnippet.length).toBeLessThanOrEqual(220);
  });
});
