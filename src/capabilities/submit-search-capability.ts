import type { AgentAction } from '../types/actions.js';
import { includesAnyNeedle } from '../utils/text.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

export class SubmitSearchCapability implements Capability {
  name = 'SubmitSearchCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = context.userGoal.toLowerCase();
    if (!includesAnyNeedle(goal, ['search', 'найди', 'submit', 'enter'])) return null;

    const filledInput = context.pageState.interactiveElements.find((element) => element.tag === 'input' && !!element.value?.trim());
    if (!filledInput) return { confidence: 0.25, reason: 'No filled search input to submit' };

    const button = context.pageState.interactiveElements.find((element) =>
      element.clickable && element.visible && element.enabled && includesAnyNeedle(`${element.text} ${element.ariaLabel ?? ''}`.toLowerCase(), ['search', 'найти']),
    );

    if (button) {
      return { confidence: 0.83, reason: 'Search button available', candidateTargets: [button.id] };
    }

    return { confidence: 0.7, reason: 'Fallback to Enter on filled input', candidateTargets: [filledInput.id] };
  }

  plan(context: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) return { type: 'ask_user', question: 'Не могу отправить поиск без заполненного поля.' };
    if (match.reason.includes('button')) return { type: 'submit_search', targetId: match.candidateTargets[0], mode: 'button' };
    const filledInput = context.pageState.interactiveElements.find((element) => element.tag === 'input' && !!element.value?.trim());
    return { type: 'submit_search', targetId: filledInput?.id ?? match.candidateTargets[0], mode: 'enter' };
  }
}
