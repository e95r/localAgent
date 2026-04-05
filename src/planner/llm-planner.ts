import type { AgentAction, Planner, PlannerInput } from '../types/actions.js';
import type { LlmClient, LlmPlannerOutput } from '../llm/llm-client.js';
import { buildLlmPlannerPrompt } from '../llm/llm-prompt-builder.js';
import { parseLlmPlannerResponse } from '../llm/llm-response-parser.js';

export interface LlmPlannerTrace {
  invoked: boolean;
  prompt?: string;
  rawResponse?: string;
  sanitizedRawResponse?: string;
  parsedResponse?: LlmPlannerOutput;
  error?: string;
  clientMetadata?: Record<string, unknown>;
  parseErrorReason?: string;
}

export class LlmPlanner implements Planner {
  public lastTrace: LlmPlannerTrace = { invoked: false };

  constructor(
    private readonly client: LlmClient,
    private readonly availableCapabilities: string[],
    private readonly confidenceThreshold = 0.6,
  ) {}


  getLastTrace(): LlmPlannerTrace {
    return this.lastTrace;
  }

  async decide(input: PlannerInput, plannerHint?: AgentAction): Promise<AgentAction> {
    const prompt = buildLlmPlannerPrompt({
      plannerInput: input,
      availableCapabilities: this.availableCapabilities,
      candidateElements: input.pageState.interactiveElements,
      plannerHint,
    });

    this.lastTrace = { invoked: true, prompt };

    try {
      const rawResponse = await this.client.generateAction({
        plannerInput: input,
        prompt,
        candidateElements: input.pageState.interactiveElements,
        availableCapabilities: this.availableCapabilities,
        plannerHint,
      });
      this.lastTrace.rawResponse = rawResponse;

      const clientWithTrace = this.client as LlmClient & { getLastTrace?: () => Record<string, unknown> };
      const clientTrace = clientWithTrace.getLastTrace?.();
      if (clientTrace) {
        this.lastTrace.clientMetadata = clientTrace;
        if (typeof clientTrace.sanitizedRawResponse === 'string') {
          this.lastTrace.sanitizedRawResponse = clientTrace.sanitizedRawResponse;
        }
      }

      const parsed = parseLlmPlannerResponse(rawResponse);
      this.lastTrace.parsedResponse = parsed;

      if (parsed.confidence < this.confidenceThreshold) {
        return {
          type: 'ask_user',
          question: 'LLM unsure. Please clarify desired action.',
          confidence: parsed.confidence,
          reason: parsed.reason,
          candidateTargets: parsed.candidateTargets,
          selectedCapabilityName: parsed.selectedCapabilityName,
          plannerSource: 'hybrid-ask-user',
        };
      }

      return mapLlmOutputToAction(parsed);
    } catch (error) {
      this.lastTrace.error = error instanceof Error ? error.message : String(error);
      this.lastTrace.parseErrorReason = this.lastTrace.error;
      return {
        type: 'ask_user',
        question: 'Не удалось интерпретировать ответ планировщика. Уточните действие.',
        reason: this.lastTrace.error,
        plannerSource: 'hybrid-ask-user',
      };
    }
  }
}

export function mapLlmOutputToAction(output: LlmPlannerOutput): AgentAction {
  const meta = {
    confidence: output.confidence,
    reason: output.reason,
    candidateTargets: output.candidateTargets,
    selectedCapabilityName: output.selectedCapabilityName,
    plannerSource: 'llm' as const,
  };

  switch (output.action) {
    case 'click':
      return { type: 'click', targetId: output.targetId!, ...meta };
    case 'type':
      return { type: 'type', targetId: output.targetId!, text: output.text!, ...meta };
    case 'extract_text':
      return { type: 'extract_text', targetId: output.targetId!, ...meta };
    case 'submit_search':
      return { type: 'submit_search', targetId: output.targetId!, mode: output.mode ?? 'button', ...meta };
    case 'finish':
      return { type: 'finish', result: output.result ?? output.reason, ...meta };
    case 'ask_user':
      return { type: 'ask_user', question: output.question ?? 'Нужна дополнительная инструкция.', ...meta, plannerSource: 'hybrid-ask-user' };
    default:
      return { type: 'ask_user', question: 'Unknown llm action', ...meta, plannerSource: 'hybrid-ask-user' };
  }
}
