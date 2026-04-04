import type { AgentAction } from '../types/actions.js';
import { includesAnyNeedle } from '../utils/text.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

export class SelectListItemCapability implements Capability {
  name = 'SelectListItemCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = context.userGoal.toLowerCase();
    if (!includesAnyNeedle(goal, ['first', 'last', 'best', 'перв', 'послед', 'выбери'])) return null;

    const items = context.pageState.interactiveElements.filter((element) => element.elementType === 'link' && element.visible && element.enabled);
    if (!items.length) return { confidence: 0.25, reason: 'No list items found' };

    if (includesAnyNeedle(goal, ['last', 'послед'])) {
      return { confidence: 0.87, reason: 'Select last item', candidateTargets: [items[items.length - 1].id] };
    }
    if (includesAnyNeedle(goal, ['first', 'перв'])) {
      return { confidence: 0.87, reason: 'Select first item', candidateTargets: [items[0].id] };
    }

    const keyword = goal.split(' ').find((token) => token.length > 3);
    const matches = keyword ? items.filter((item) => item.text.toLowerCase().includes(keyword)) : [];
    if (matches.length === 1) return { confidence: 0.8, reason: 'Best match item found', candidateTargets: [matches[0].id] };
    if (matches.length > 1) return { confidence: 0.52, reason: 'Several equal list item matches', candidateTargets: matches.map((item) => item.id) };
    return { confidence: 0.4, reason: 'No best match item found' };
  }

  plan(_: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) return { type: 'ask_user', question: 'Не удалось выбрать элемент списка.' };
    if (match.candidateTargets.length > 1) return { type: 'ask_user', question: 'Несколько элементов списка подходят одинаково. Какой выбрать?' };
    return { type: 'click', targetId: match.candidateTargets[0] };
  }
}
