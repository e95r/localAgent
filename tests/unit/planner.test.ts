import { describe, expect, it } from 'vitest';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import type { PageState } from '../../src/types/page-state.js';

const planner = new RuleBasedPlanner();

function state(elements: PageState['interactiveElements']): PageState {
  return { url: 'http://x', title: 'x', visibleText: '', interactiveElements: elements };
}

describe('RuleBasedPlanner', () => {
  it('returns click for single download target', () => {
    const action = planner.decide({
      userGoal: 'скачать файл',
      pageState: state([
        { id: 'el-1', tag: 'button', role: null, text: 'Download PDF', ariaLabel: null, href: null, visible: true, enabled: true, boundingBox: null, selectorHint: '#a', domSnippet: '' },
      ]),
      actionHistory: [],
    });
    expect(action.type).toBe('click');
  });

  it('returns ask_user for ambiguous download buttons', () => {
    const action = planner.decide({
      userGoal: 'download',
      pageState: state([
        { id: 'el-1', tag: 'button', role: null, text: 'Download A', ariaLabel: null, href: null, visible: true, enabled: true, boundingBox: null, selectorHint: '#a', domSnippet: '' },
        { id: 'el-2', tag: 'button', role: null, text: 'Download B', ariaLabel: null, href: null, visible: true, enabled: true, boundingBox: null, selectorHint: '#b', domSnippet: '' },
      ]),
      actionHistory: [],
    });
    expect(action.type).toBe('ask_user');
  });

  it('returns fallback ask_user on unknown goal', () => {
    const action = planner.decide({ userGoal: 'do magic', pageState: state([]), actionHistory: [] });
    expect(action.type).toBe('ask_user');
  });
});
