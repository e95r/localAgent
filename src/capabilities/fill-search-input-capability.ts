import type { AgentAction } from '../types/actions.js';
import { includesAnyNeedle } from '../utils/text.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

export class FillSearchInputCapability implements Capability {
  name = 'FillSearchInputCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = context.userGoal.toLowerCase();
    if (!includesAnyNeedle(goal, ['search', 'поиск', 'найд'])) return null;

    const inputs = context.pageState.interactiveElements.filter((element) => {
      const searchLike =
        element.tag === 'input' &&
        (element.role === 'searchbox' || includesAnyNeedle(`${element.ariaLabel ?? ''} ${element.placeholder ?? ''}`.toLowerCase(), ['search', 'поиск']));
      return element.visible && element.enabled && searchLike;
    });

    if (!inputs.length) return { confidence: 0.3, reason: 'No search input found' };
    return {
      confidence: inputs.length === 1 ? 0.9 : 0.52,
      reason: inputs.length === 1 ? 'Single search input found' : 'Multiple search-like inputs',
      candidateTargets: inputs.map((input) => input.id),
    };
  }

  plan(context: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) return { type: 'ask_user', question: 'Не нашёл поле поиска.' };
    if (match.candidateTargets.length > 1) return { type: 'ask_user', question: 'На странице несколько полей поиска. Какое использовать?' };
    const query = extractSearchQuery(context.userGoal);
    return { type: 'type', targetId: match.candidateTargets[0], text: query };
  }
}

function extractSearchQuery(goal: string): string {
  const byQuotes = goal.match(/["“](.+?)["”]/);
  if (byQuotes?.[1]) return byQuotes[1];
  const cleaned = goal.replace(/(найди|search|поиск|for|по|запрос)/gi, '').trim();
  return cleaned || 'test query';
}
