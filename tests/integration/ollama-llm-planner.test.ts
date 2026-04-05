import { describe, expect, it } from 'vitest';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { OllamaLlmClient } from '../../src/llm/ollama-client.js';
import { createLlmClientFromConfig } from '../../src/llm/llm-client-factory.js';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { makeElement, makeState } from '../unit/helpers.js';

const input = { userGoal: 'download primary', pageState: makeState([makeElement({ id: 'el-1', text: 'Primary download' })]), actionHistory: [] };

describe('ollama llm planner integration (stubbed HTTP)', () => {
  it('valid response executes planner action', async () => {
    const client = new OllamaLlmClient(
      { enabled: true },
      {
        fetchImpl: (async () =>
          new Response(
            JSON.stringify({ response: '{"selectedCapabilityName":"DownloadCapability","action":"click","targetId":"el-1","confidence":0.9,"reason":"ok","candidateTargets":["el-1"]}' }),
            { status: 200 },
          )) as any,
      },
    );
    const planner = new LlmPlanner(client, ['DownloadCapability']);
    const action = await planner.decide(input as any);
    expect(action.type).toBe('click');
    expect(planner.getLastTrace().clientMetadata?.model).toBeTruthy();
  });

  it('invalid json payload goes to ask_user with parse reason', async () => {
    const client = new OllamaLlmClient({ enabled: true }, { fetchImpl: (async () => new Response(JSON.stringify({ response: 'not json' }), { status: 200 })) as any });
    const planner = new LlmPlanner(client, ['DownloadCapability']);
    const action = await planner.decide(input as any);
    expect(action.type).toBe('ask_user');
    expect(planner.getLastTrace().parseErrorReason).toContain('Invalid JSON');
  });

  it('timeout path returns ask_user and retry recovers on transient failure', async () => {
    let call = 0;
    const client = new OllamaLlmClient(
      { enabled: true, timeoutMs: 120, retries: 1 },
      {
        fetchImpl: (async (_url: string, init?: RequestInit) => {
          call += 1;
          if (call === 1) {
            await new Promise((resolve, reject) => {
              (init?.signal as AbortSignal).addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
            });
          }
          return new Response(
            JSON.stringify({ response: '{"selectedCapabilityName":"DownloadCapability","action":"click","targetId":"el-1","confidence":0.9,"reason":"ok","candidateTargets":["el-1"]}' }),
            { status: 200 },
          );
        }) as any,
      },
    );

    const planner = new LlmPlanner(client, ['DownloadCapability']);
    const action = await planner.decide(input as any);
    expect(action.type).toBe('click');
    expect(call).toBe(2);
  });

  it('disabled local client path can fallback to fake client', async () => {
    const client = createLlmClientFromConfig({ enabled: false }, new FakeLlmClient(() => '{"selectedCapabilityName":"DownloadCapability","action":"ask_user","confidence":0.9,"reason":"disabled","candidateTargets":[]}'));
    const planner = new LlmPlanner(client, ['DownloadCapability']);
    const action = await planner.decide(input as any);
    expect(action.type).toBe('ask_user');
  });
});
