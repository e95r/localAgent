import { describe, expect, it } from 'vitest';
import { buildLlmPlannerPrompt } from '../../src/llm/llm-prompt-builder.js';
import { makeElement, makeState } from './helpers.js';

describe('buildLlmPlannerPrompt', () => {
  it('builds deterministic prompt', () => {
    const input = {
      plannerInput: { userGoal: 'open latest', pageState: makeState([makeElement({ id: 'b', text: 'B' }), makeElement({ id: 'a', text: 'A' })]), actionHistory: [] },
      candidateElements: [makeElement({ id: 'b', text: 'B' }), makeElement({ id: 'a', text: 'A' })],
      availableCapabilities: ['Z', 'A'],
    };

    const p1 = buildLlmPlannerPrompt(input);
    const p2 = buildLlmPlannerPrompt(input);
    expect(p1).toBe(p2);
    expect(p1).toContain('Response schema');
    expect(p1).toContain('Available capabilities: A, Z');
  });
});
