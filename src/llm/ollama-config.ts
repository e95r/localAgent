export interface OllamaConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  numPredict: number;
  retries: number;
  keepAlive?: string;
  enableJsonMode: boolean;
}

export const defaultOllamaConfig: OllamaConfig = {
  enabled: false,
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen2.5:7b-instruct',
  timeoutMs: 12_000,
  temperature: 0,
  numPredict: 320,
  retries: 1,
  keepAlive: undefined,
  enableJsonMode: true,
};

export class OllamaConfigError extends Error {}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new OllamaConfigError(`Invalid boolean value: ${value}`);
}

function parseNumber(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new OllamaConfigError(`${label} must be a finite number`);
  return parsed;
}

export function validateOllamaConfig(config: OllamaConfig): OllamaConfig {
  if (!config.baseUrl.trim()) throw new OllamaConfigError('OLLAMA_BASE_URL is required');
  try {
    const parsed = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new OllamaConfigError('OLLAMA_BASE_URL must use http/https protocol');
    }
  } catch {
    throw new OllamaConfigError('OLLAMA_BASE_URL must be a valid URL');
  }

  if (!config.model.trim()) throw new OllamaConfigError('OLLAMA_MODEL is required');
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 100) throw new OllamaConfigError('OLLAMA_TIMEOUT_MS must be integer >= 100');
  if (config.temperature < 0 || config.temperature > 2) throw new OllamaConfigError('OLLAMA_TEMPERATURE must be in range 0..2');
  if (!Number.isInteger(config.numPredict) || config.numPredict <= 0) throw new OllamaConfigError('OLLAMA_NUM_PREDICT must be integer > 0');
  if (!Number.isInteger(config.retries) || config.retries < 0 || config.retries > 5) throw new OllamaConfigError('OLLAMA_RETRIES must be integer 0..5');

  return config;
}

export function parseOllamaConfigFromEnv(env: NodeJS.ProcessEnv = process.env): OllamaConfig {
  const config: OllamaConfig = {
    enabled: parseBoolean(env.OLLAMA_ENABLED, defaultOllamaConfig.enabled),
    baseUrl: env.OLLAMA_BASE_URL?.trim() || defaultOllamaConfig.baseUrl,
    model: env.OLLAMA_MODEL?.trim() || defaultOllamaConfig.model,
    timeoutMs: Math.round(parseNumber(env.OLLAMA_TIMEOUT_MS, defaultOllamaConfig.timeoutMs, 'OLLAMA_TIMEOUT_MS')),
    temperature: parseNumber(env.OLLAMA_TEMPERATURE, defaultOllamaConfig.temperature, 'OLLAMA_TEMPERATURE'),
    numPredict: Math.round(parseNumber(env.OLLAMA_NUM_PREDICT, defaultOllamaConfig.numPredict, 'OLLAMA_NUM_PREDICT')),
    retries: Math.round(parseNumber(env.OLLAMA_RETRIES, defaultOllamaConfig.retries, 'OLLAMA_RETRIES')),
    keepAlive: env.OLLAMA_KEEP_ALIVE?.trim() || defaultOllamaConfig.keepAlive,
    enableJsonMode: parseBoolean(env.OLLAMA_ENABLE_JSON_MODE, defaultOllamaConfig.enableJsonMode),
  };

  return validateOllamaConfig(config);
}

export function withOllamaConfig(overrides: Partial<OllamaConfig> = {}): OllamaConfig {
  return validateOllamaConfig({ ...defaultOllamaConfig, ...overrides });
}
