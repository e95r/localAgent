import { describe, expect, it } from 'vitest';
import { mapTargetIdToSelector } from '../../src/utils/target-map.js';
import { makeElement } from './helpers.js';

const items = [makeElement({ id: 'el-1', selectorHint: '#download' })];

describe('target-map', () => {
  it('maps existing target', () => {
    expect(mapTargetIdToSelector('el-1', items)).toBe('#download');
  });

  it('throws on missing target', () => {
    expect(() => mapTargetIdToSelector('missing', items)).toThrow(/not found/);
  });

  it('resolves data-agent-id selectorHint correctly', () => {
    const dataAgentItems = [makeElement({ id: 'el-7', selectorHint: '[data-agent-id="el-7"]' })];
    expect(mapTargetIdToSelector('el-7', dataAgentItems)).toBe('[data-agent-id="el-7"]');
  });
});
