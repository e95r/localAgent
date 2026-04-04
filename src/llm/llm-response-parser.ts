import { LLM_ACTION_TYPES, type LlmPlannerOutput } from './llm-client.js';

export class LlmResponseParseError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function validateLlmPlannerResponse(value: unknown): LlmPlannerOutput {
  if (!isObject(value)) throw new LlmResponseParseError('LLM response is not an object');

  const action = value.action;
  if (typeof action !== 'string' || !LLM_ACTION_TYPES.includes(action as any)) {
    throw new LlmResponseParseError(`Unknown action type: ${String(action)}`);
  }

  const confidence = value.confidence;
  if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new LlmResponseParseError('confidence must be number in range 0..1');
  }

  if (typeof value.selectedCapabilityName !== 'string' || !value.selectedCapabilityName.trim()) {
    throw new LlmResponseParseError('selectedCapabilityName is required');
  }

  if (typeof value.reason !== 'string' || !value.reason.trim()) {
    throw new LlmResponseParseError('reason is required');
  }

  if (!Array.isArray(value.candidateTargets) || !value.candidateTargets.every((item) => typeof item === 'string')) {
    throw new LlmResponseParseError('candidateTargets must be string[]');
  }

  const requiresTarget = ['click', 'type', 'extract_text', 'submit_search'].includes(action);
  if (requiresTarget && (typeof value.targetId !== 'string' || !value.targetId.trim())) {
    throw new LlmResponseParseError(`targetId is required for action ${action}`);
  }

  if (action === 'type' && (typeof value.text !== 'string' || !value.text.length)) {
    throw new LlmResponseParseError('text is required for type action');
  }

  if (action === 'submit_search' && value.mode !== undefined && value.mode !== 'button' && value.mode !== 'enter') {
    throw new LlmResponseParseError('submit_search mode must be button|enter');
  }

  if (value.warnings !== undefined && (!Array.isArray(value.warnings) || !value.warnings.every((item) => typeof item === 'string'))) {
    throw new LlmResponseParseError('warnings must be string[]');
  }

  if (action === 'ask_user' && value.question !== undefined && typeof value.question !== 'string') {
    throw new LlmResponseParseError('question must be string');
  }

  if (action === 'finish' && value.result !== undefined && typeof value.result !== 'string') {
    throw new LlmResponseParseError('result must be string');
  }

  return value as unknown as LlmPlannerOutput;
}

export function parseLlmPlannerResponse(raw: string): LlmPlannerOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LlmResponseParseError('Invalid JSON in LLM response');
  }
  return validateLlmPlannerResponse(parsed);
}
