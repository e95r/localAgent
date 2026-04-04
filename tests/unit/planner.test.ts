import { describe, expect, it } from 'vitest';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { makeElement, makeState } from './helpers.js';

describe('RuleBasedPlanner with capabilities', () => {
  const planner = new RuleBasedPlanner();

  it('returns click for single download target and explainability fields', () => {
    const action = planner.decide({
      userGoal: 'скачать файл',
      pageState: makeState([makeElement({ id: 'd1', text: 'Download PDF' })]),
      actionHistory: [],
    });
    expect(action.type).toBe('click');
    expect(action.selectedCapabilityName).toBe('DownloadCapability');
    expect(action.confidence).toBeGreaterThan(0.6);
  });

  it('returns ask_user under low confidence/ambiguity', () => {
    const action = planner.decide({
      userGoal: 'download',
      pageState: makeState([makeElement({ id: 'd1', text: 'Download A' }), makeElement({ id: 'd2', text: 'Download B' })]),
      actionHistory: [],
    });
    expect(action.type).toBe('ask_user');
    expect(action.candidateTargets?.length).toBeGreaterThan(1);
  });
});
