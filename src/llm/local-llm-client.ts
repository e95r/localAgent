import type { LlmClient, LlmPlannerRequest } from './llm-client.js';

/**
 * Placeholder adapter for local model engines (Ollama, llama.cpp, etc).
 * Keep out of default tests; tests should use FakeLlmClient/Stub behavior.
 */
export class LocalLlmClient implements LlmClient {
  async generateAction(_input: LlmPlannerRequest): Promise<string> {
    throw new Error('LocalLlmClient is a placeholder. Provide engine integration in your environment.');
  }
}
