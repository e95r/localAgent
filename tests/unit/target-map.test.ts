import { describe, expect, it } from 'vitest';
import { mapTargetIdToSelector } from '../../src/utils/target-map.js';
import type { InteractiveElement } from '../../src/types/page-state.js';

const items: InteractiveElement[] = [
  {
    id: 'el-1',
    tag: 'button',
    role: null,
    text: 'Download',
    ariaLabel: null,
    href: null,
    visible: true,
    enabled: true,
    boundingBox: null,
    selectorHint: '#download',
    domSnippet: '<button id="download">Download</button>',
  },
];

describe('target-map', () => {
  it('maps existing target', () => {
    expect(mapTargetIdToSelector('el-1', items)).toBe('#download');
  });

  it('throws on missing target', () => {
    expect(() => mapTargetIdToSelector('missing', items)).toThrow(/not found/);
  });
});
