import type { AgentAction, PlannerInput } from '../types/actions.js';
import type { InteractiveElement } from '../types/page-state.js';

export interface LlmPromptInput {
  plannerInput: PlannerInput;
  candidateElements: InteractiveElement[];
  availableCapabilities: string[];
  plannerHint?: AgentAction;
}

const RESPONSE_SCHEMA = {
  selectedCapabilityName: 'string',
  action: 'click|type|extract_text|submit_search|ask_user|finish',
  targetId: 'string (required for click/type/extract_text/submit_search)',
  text: 'string (required for type)',
  mode: 'button|enter (optional, only submit_search)',
  confidence: 'number 0..1',
  reason: 'string',
  candidateTargets: 'string[]',
  warnings: 'string[] optional',
  question: 'string optional for ask_user',
  result: 'string optional for finish',
} as const;

function summarizeActionHistory(history: AgentAction[]): string {
  return history
    .slice(-5)
    .map((action, index) => `${index + 1}. ${action.type}${'targetId' in action ? `(${action.targetId})` : ''}`)
    .join('\n');
}

export function buildLlmPlannerPrompt(input: LlmPromptInput): string {
  const { plannerInput, candidateElements, availableCapabilities, plannerHint } = input;

  const candidates = candidateElements
    .slice(0, 20)
    .map((el) => ({ id: el.id, tag: el.tag, text: el.text, role: el.role, clickable: el.clickable, enabled: el.enabled, visible: el.visible }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return [
    'You are a planner for a browser agent. Return JSON only.',
    `User goal: ${plannerInput.userGoal}`,
    `URL: ${plannerInput.pageState.url}`,
    `Title: ${plannerInput.pageState.title}`,
    `Visible text excerpt: ${plannerInput.pageState.visibleText.slice(0, 240)}`,
    `Available capabilities: ${availableCapabilities.sort().join(', ')}`,
    `Recent action history:\n${summarizeActionHistory(plannerInput.actionHistory) || 'none'}`,
    plannerHint ? `Rule-based hint: ${JSON.stringify(plannerHint)}` : 'Rule-based hint: none',
    `Candidate elements: ${JSON.stringify(candidates)}`,
    `Response schema: ${JSON.stringify(RESPONSE_SCHEMA)}`,
    'Return exactly one JSON object. No markdown. No commentary.',
  ].join('\n');
}
