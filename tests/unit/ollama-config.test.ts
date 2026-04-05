import { describe, expect, it } from 'vitest';
import { defaultOllamaConfig, parseOllamaConfigFromEnv, validateOllamaConfig, withOllamaConfig } from '../../src/llm/ollama-config.js';

describe('ollama config', () => {
  it('parses env to typed config', () => {
    const config = parseOllamaConfigFromEnv({
      OLLAMA_ENABLED: 'true',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'qwen2.5:14b-instruct',
      OLLAMA_TIMEOUT_MS: '15000',
      OLLAMA_TEMPERATURE: '0.1',
      OLLAMA_NUM_PREDICT: '256',
      OLLAMA_RETRIES: '2',
      OLLAMA_KEEP_ALIVE: '5m',
      OLLAMA_ENABLE_JSON_MODE: '1',
    } as NodeJS.ProcessEnv);

    expect(config.enabled).toBe(true);
    expect(config.model).toContain('14b');
    expect(config.numPredict).toBe(256);
  });

  it('validates explicit config and supports defaults', () => {
    const config = withOllamaConfig({ enabled: false });
    expect(config.baseUrl).toBe(defaultOllamaConfig.baseUrl);
    expect(validateOllamaConfig(config)).toEqual(config);
  });

  it('rejects invalid env/config', () => {
    expect(() => parseOllamaConfigFromEnv({ OLLAMA_ENABLED: 'maybe' } as NodeJS.ProcessEnv)).toThrow(/Invalid boolean/);
    expect(() => withOllamaConfig({ timeoutMs: 20 })).toThrow(/TIMEOUT/);
  });
});
