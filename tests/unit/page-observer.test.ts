import { describe, expect, it } from 'vitest';
import { DOMPageObserver, buildAgentElementId, buildSelectorHint } from '../../src/observer/page-observer.js';

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

  it('creates stable selectorHint for clickable element without DOM id', async () => {
    const id = buildAgentElementId(3);
    expect(buildSelectorHint(null, id)).toBe('[data-agent-id="el-3"]');
  });

  it('selectorHint for second anchor among body + 3 anchors points to second anchor, not third', async () => {
    const secondAnchorCandidateIndex = 2; // body + first anchor + second anchor
    const thirdAnchorCandidateIndex = 3;
    const secondSelector = buildSelectorHint(null, buildAgentElementId(secondAnchorCandidateIndex));
    const thirdSelector = buildSelectorHint(null, buildAgentElementId(thirdAnchorCandidateIndex));
    expect(secondSelector).toBe('[data-agent-id="el-2"]');
    expect(secondSelector).not.toBe(thirdSelector);
  });

  it('selectorHint for third anchor among body + 3 anchors points to third anchor, not nonexistent a:nth-of-type(4)', async () => {
    const thirdAnchorCandidateIndex = 3; // body + three anchors -> third anchor is el-3
    const selector = buildSelectorHint(null, buildAgentElementId(thirdAnchorCandidateIndex));
    expect(selector).toBe('[data-agent-id="el-3"]');
    expect(selector).not.toContain('nth-of-type(4)');
  });

  it('repeated collect() does not produce broken selectorHint behavior', async () => {
    const firstSnapshotSelector = buildSelectorHint(null, buildAgentElementId(5));
    const secondSnapshotSelector = buildSelectorHint(null, buildAgentElementId(5));
    expect(firstSnapshotSelector).toBe(secondSnapshotSelector);
  });
});
