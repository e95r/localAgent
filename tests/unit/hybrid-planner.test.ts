import { describe, expect, it } from 'vitest';
import { HybridPlanner } from '../../src/planner/hybrid-planner.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { makeElement, makeState } from './helpers.js';

const highRuleInput = { userGoal: 'download', pageState: makeState([makeElement({ id: 'el-1', text: 'Download PDF' })]), actionHistory: [] };
const ambiguousInput = { userGoal: 'download', pageState: makeState([makeElement({ id: 'el-1', text: 'Download A' }), makeElement({ id: 'el-2', text: 'Download B' })]), actionHistory: [] };

describe('HybridPlanner', () => {
  it('skips llm for high-confidence rule action', async () => {
    const llm = new LlmPlanner(new FakeLlmClient(() => { throw new Error('must not call'); }), ['DownloadCapability']);
    const planner = new HybridPlanner(new RuleBasedPlanner(), llm);
    const action = await planner.decide(highRuleInput);
    expect(action.plannerSource).toBe('rule-based');
  });

  it('uses llm on low-confidence/ambiguous rule action', async () => {
    const llm = new LlmPlanner(new FakeLlmClient(() => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: 'el-1', confidence: 0.9, reason: 'picked', candidateTargets: ['el-1'] })), ['DownloadCapability']);
    const planner = new HybridPlanner(new RuleBasedPlanner(), llm);
    const action = await planner.decide(ambiguousInput);
    expect(action.type).toBe('click');
    expect(action.plannerSource).toBe('llm');
  });

  it('returns ask_user when llm still ambiguous', async () => {
    const llm = new LlmPlanner(new FakeLlmClient(() => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'ask_user', confidence: 0.4, reason: 'ambiguous', candidateTargets: ['el-1', 'el-2'] })), ['DownloadCapability']);
    const planner = new HybridPlanner(new RuleBasedPlanner(), llm);
    const action = await planner.decide(ambiguousInput);
    expect(action.type).toBe('ask_user');
    expect(action.plannerSource).toBe('hybrid-ask-user');
  });
});
