import type { OllamaClientDeps } from './ollama-client.js';
import { OllamaLlmClient } from './ollama-client.js';
import type { OllamaConfig } from './ollama-config.js';

/**
 * Backward-compatible local client alias.
 * Iteration 4 implementation is Ollama-based.
 */
export class LocalLlmClient extends OllamaLlmClient {
  constructor(config: Partial<OllamaConfig> = {}, deps: OllamaClientDeps = {}) {
    super(config, deps);
  }
}
