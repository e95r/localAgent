import type { LlmClient } from './llm-client.js';
import { FakeLlmClient } from './fake-llm-client.js';
import { OllamaLlmClient } from './ollama-client.js';
import { parseOllamaConfigFromEnv, type OllamaConfig } from './ollama-config.js';

export function createLlmClientFromConfig(config: Partial<OllamaConfig> & { enabled?: boolean }, fallback?: LlmClient): LlmClient {
  if (!config.enabled) return fallback ?? new FakeLlmClient(() => {
    throw new Error('LLM client disabled. Provide FakeLlmClient responder or enable Ollama config.');
  });
  return new OllamaLlmClient(config);
}

export function createLlmClientFromEnv(env: NodeJS.ProcessEnv = process.env, fallback?: LlmClient): LlmClient {
  const config = parseOllamaConfigFromEnv(env);
  return createLlmClientFromConfig(config, fallback);
}
