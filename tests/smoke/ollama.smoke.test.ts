import { describe, expect, it } from 'vitest';
import { createLlmClientFromEnv } from '../../src/llm/llm-client-factory.js';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { makeElement, makeState } from '../unit/helpers.js';

const smokeEnabled = process.env.OLLAMA_SMOKE === '1';
const describeSmoke = smokeEnabled ? describe : describe.skip;

describeSmoke('ollama smoke tests (optional)', () => {
  const input = {
    userGoal: 'click download',
    pageState: makeState([makeElement({ id: 'el-1', text: 'Download now' })]),
    actionHistory: [],
  };

  it('returns parseable json for minimal prompt', async () => {
    const client = createLlmClientFromEnv({ ...process.env, OLLAMA_ENABLED: 'true' });
    const raw = await client.generateAction({
      plannerInput: input as any,
      candidateElements: input.pageState.interactiveElements,
      availableCapabilities: ['DownloadCapability'],
      prompt: 'Return only strict JSON object with action ask_user and confidence 0.8',
    } as any);
    expect(() => JSON.parse(raw)).not.toThrow();
  }, 30_000);

  it('can produce valid click action through planner', async () => {
    const client = createLlmClientFromEnv({ ...process.env, OLLAMA_ENABLED: 'true' });
    const planner = new LlmPlanner(client, ['DownloadCapability']);
    const action = await planner.decide(input as any);
    expect(['click', 'ask_user', 'finish']).toContain(action.type);
  }, 30_000);

  it('invalid model or unavailable server fails cleanly', async () => {
    const client = createLlmClientFromEnv({
      ...process.env,
      OLLAMA_ENABLED: 'true',
      OLLAMA_MODEL: 'definitely-not-existing-model-name',
      OLLAMA_TIMEOUT_MS: '5000',
    });

    await expect(
      client.generateAction({
        plannerInput: input as any,
        candidateElements: input.pageState.interactiveElements,
        availableCapabilities: ['DownloadCapability'],
        prompt: 'Return JSON',
      } as any),
    ).rejects.toThrow();
  }, 30_000);
});
