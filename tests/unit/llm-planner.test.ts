import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { makeElement, makeState } from './helpers.js';

const input = { userGoal: 'download primary', pageState: makeState([makeElement({ id: 'el-1', text: 'Primary download' })]), actionHistory: [] };

describe('LlmPlanner', () => {
  it('maps valid response to action', async () => {
    const planner = new LlmPlanner(
      new FakeLlmClient(() => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: 'el-1', confidence: 0.9, reason: 'good', candidateTargets: ['el-1'] })),
      ['DownloadCapability'],
    );
    const action = await planner.decide(input);
    expect(action.type).toBe('click');
    expect(action.plannerSource).toBe('llm');
  });

  it('returns ask_user on parse failure', async () => {
    const planner = new LlmPlanner(new FakeLlmClient(() => 'bad-json'), ['DownloadCapability']);
    const action = await planner.decide(input);
    expect(action.type).toBe('ask_user');
  });

  it('returns ask_user when llm confidence low', async () => {
    const planner = new LlmPlanner(
      new FakeLlmClient(() => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: 'el-1', confidence: 0.2, reason: 'unsure', candidateTargets: ['el-1'] })),
      ['DownloadCapability'],
      0.6,
    );
    const action = await planner.decide(input);
    expect(action.type).toBe('ask_user');
  });
});
