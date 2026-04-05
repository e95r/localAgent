import { describe, expect, it, vi } from 'vitest';
import { OllamaLlmClient } from '../../src/llm/ollama-client.js';

const request = {
  prompt: 'Return JSON only',
  plannerInput: {} as any,
  candidateElements: [],
  availableCapabilities: [],
} as any;

describe('OllamaLlmClient', () => {
  it('extracts raw model text on success and builds deterministic payload', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      expect(payload.options.temperature).toBe(0);
      expect(payload.format).toBe('json');
      return new Response(JSON.stringify({ response: '{"action":"ask_user"}' }), { status: 200 });
    });

    const client = new OllamaLlmClient({ enabled: true, model: 'qwen2.5:7b-instruct' }, { fetchImpl: fetchImpl as any });
    await expect(client.generateAction(request)).resolves.toContain('action');
  });

  it('throws meaningful error on empty/malformed payload', async () => {
    const client = new OllamaLlmClient(
      { enabled: true },
      { fetchImpl: (async () => new Response(JSON.stringify({ response: '' }), { status: 200 })) as any },
    );
    await expect(client.generateAction(request)).rejects.toThrow(/Empty or unexpected/);
  });

  it('maps timeout and stops retries by configured attempts', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        const signal = init?.signal as AbortSignal;
        signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      });
      return new Response('{}');
    });

    const client = new OllamaLlmClient({ enabled: true, timeoutMs: 120, retries: 2 }, { fetchImpl: fetchImpl as any });
    await expect(client.generateAction(request)).rejects.toThrow(/timeout/i);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries transient failure then succeeds', async () => {
    let call = 0;
    const client = new OllamaLlmClient(
      { enabled: true, retries: 1 },
      {
        fetchImpl: (async () => {
          call += 1;
          if (call === 1) throw new Error('fetch failed');
          return new Response(JSON.stringify({ response: '```json\n{"ok":true}\n```' }), { status: 200 });
        }) as any,
      },
    );

    await expect(client.generateAction(request)).resolves.toBe('{"ok":true}');
    expect(client.getLastTrace().retryAttemptsUsed).toBe(1);
  });
});
