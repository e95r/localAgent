import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { createLlmClientFromConfig, createLlmClientFromEnv } from '../../src/llm/llm-client-factory.js';
import { OllamaLlmClient } from '../../src/llm/ollama-client.js';

describe('llm-client-factory', () => {
  it('does not instantiate real client when disabled', () => {
    const fallback = new FakeLlmClient(() => '{"ok":true}');
    const client = createLlmClientFromConfig({ enabled: false }, fallback);
    expect(client).toBe(fallback);
  });

  it('instantiates ollama client when enabled', () => {
    const client = createLlmClientFromEnv({ OLLAMA_ENABLED: 'true' } as NodeJS.ProcessEnv);
    expect(client).toBeInstanceOf(OllamaLlmClient);
  });
});
