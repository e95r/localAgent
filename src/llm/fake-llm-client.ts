import type { LlmClient, LlmPlannerRequest } from './llm-client.js';

export class FakeLlmClient implements LlmClient {
  constructor(private readonly responder: (input: LlmPlannerRequest) => string | Promise<string>) {}

  async generateAction(input: LlmPlannerRequest): Promise<string> {
    return this.responder(input);
  }
}
