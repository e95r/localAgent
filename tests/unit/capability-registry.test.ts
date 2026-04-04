import { describe, expect, it } from 'vitest';
import { DefaultCapabilityRegistry } from '../../src/capabilities/capability-registry.js';
import type { Capability } from '../../src/capabilities/types.js';

describe('CapabilityRegistry ranking', () => {
  it('sorts by confidence descending', () => {
    const caps: Capability[] = [
      { name: 'low', canHandle: () => ({ confidence: 0.2, reason: 'low' }), plan: () => ({ type: 'ask_user', question: 'x' }) },
      { name: 'high', canHandle: () => ({ confidence: 0.9, reason: 'high' }), plan: () => ({ type: 'ask_user', question: 'x' }) },
    ];
    const ranked = new DefaultCapabilityRegistry(caps).rank({ userGoal: 'x', pageState: { url: 'x', title: 'x', visibleText: '', interactiveElements: [] }, actionHistory: [] });
    expect(ranked[0].capability.name).toBe('high');
  });
});
