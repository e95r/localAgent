import type { LlmClient, LlmPlannerRequest } from './llm-client.js';
import type { OllamaConfig } from './ollama-config.js';
import { withOllamaConfig } from './ollama-config.js';
import { extractOllamaModelText, OllamaResponseError, sanitizeModelText } from './ollama-response.js';

export interface OllamaClientTrace {
  model: string;
  baseUrl: string;
  timeoutMs: number;
  retries: number;
  retryAttemptsUsed: number;
  enableJsonMode: boolean;
  sanitizedRawResponse?: string;
  parseError?: string;
}

export class OllamaClientError extends Error {
  constructor(message: string, public readonly code: 'timeout' | 'unavailable' | 'http_error' | 'invalid_payload' | 'unknown') {
    super(message);
  }
}

export interface OllamaClientDeps {
  fetchImpl?: typeof fetch;
}

export class OllamaLlmClient implements LlmClient {
  private readonly config: OllamaConfig;
  private readonly fetchImpl: typeof fetch;
  private trace: OllamaClientTrace;

  constructor(config: Partial<OllamaConfig> = {}, deps: OllamaClientDeps = {}) {
    this.config = withOllamaConfig(config);
    this.fetchImpl = deps.fetchImpl ?? fetch;
    this.trace = {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      retries: this.config.retries,
      retryAttemptsUsed: 0,
      enableJsonMode: this.config.enableJsonMode,
    };
  }

  getLastTrace(): OllamaClientTrace {
    return this.trace;
  }

  private buildPayload(input: LlmPlannerRequest): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: this.config.model,
      prompt: input.prompt,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.numPredict,
      },
    };

    if (this.config.keepAlive) payload.keep_alive = this.config.keepAlive;
    if (this.config.enableJsonMode) payload.format = 'json';

    return payload;
  }

  async generateAction(input: LlmPlannerRequest): Promise<string> {
    let lastError: unknown;
    this.trace = {
      model: this.config.model,
      baseUrl: this.config.baseUrl,
      timeoutMs: this.config.timeoutMs,
      retries: this.config.retries,
      retryAttemptsUsed: 0,
      enableJsonMode: this.config.enableJsonMode,
    };

    for (let attempt = 0; attempt <= this.config.retries; attempt += 1) {
      this.trace.retryAttemptsUsed = attempt;
      try {
        const text = await this.requestOnce(input);
        const sanitized = sanitizeModelText(text);
        this.trace.sanitizedRawResponse = sanitized;
        return sanitized;
      } catch (error) {
        lastError = error;
        if (error instanceof OllamaClientError && error.code === 'invalid_payload') {
          this.trace.parseError = error.message;
          throw error;
        }
        if (attempt >= this.config.retries) break;
      }
    }

    if (lastError instanceof OllamaClientError) throw lastError;
    throw new OllamaClientError('Unknown Ollama request failure', 'unknown');
  }

  private async requestOnce(input: LlmPlannerRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.config.baseUrl.replace(/\/$/, '')}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildPayload(input)),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new OllamaClientError(`Ollama HTTP error ${response.status}`, 'http_error');
      }

      const payload = await response.json();
      try {
        return extractOllamaModelText(payload);
      } catch (error) {
        if (error instanceof OllamaResponseError) {
          throw new OllamaClientError(error.message, 'invalid_payload');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof OllamaClientError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new OllamaClientError(`Ollama request timeout after ${this.config.timeoutMs}ms`, 'timeout');
      }
      if (error instanceof Error && /ECONNREFUSED|ENOTFOUND|fetch failed/i.test(error.message)) {
        throw new OllamaClientError(`Ollama server unavailable at ${this.config.baseUrl}`, 'unavailable');
      }
      throw new OllamaClientError(error instanceof Error ? error.message : String(error), 'unknown');
    } finally {
      clearTimeout(timeout);
    }
  }
}
