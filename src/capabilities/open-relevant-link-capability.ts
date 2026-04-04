import { includesAnyNeedle, normalizeText } from '../utils/text.js';
import type { AgentAction } from '../types/actions.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

export class OpenRelevantLinkCapability implements Capability {
  name = 'OpenRelevantLinkCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = normalizeText(context.userGoal.toLowerCase());
    if (!includesAnyNeedle(goal, ['open', 'открой', 'ссыл'])) return null;

    const links = context.pageState.interactiveElements.filter((element) => element.elementType === 'link' && element.visible && element.enabled);
    if (!links.length) return { confidence: 0.2, reason: 'No links found' };

    if (includesAnyNeedle(goal, ['перв', 'first'])) {
      return { confidence: 0.85, reason: 'Goal asks first link', candidateTargets: [links[0].id] };
    }

    const tokens = goal.split(' ').filter((token) => token.length > 2);
    const scored = links
      .map((link) => ({
        id: link.id,
        score: tokens.reduce((acc, token) => acc + (normalizeText(link.text.toLowerCase()).includes(token) ? 1 : 0), 0),
      }))
      .sort((a, b) => b.score - a.score);

    if (!scored[0] || scored[0].score === 0) {
      return { confidence: 0.35, reason: 'No keyword match in links' };
    }

    const equalTop = scored.filter((item) => item.score === scored[0].score);
    return {
      confidence: equalTop.length > 1 ? 0.5 : 0.82,
      reason: equalTop.length > 1 ? 'Multiple equally relevant links' : 'Best matching link found',
      candidateTargets: equalTop.map((item) => item.id),
    };
  }

  plan(_: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) return { type: 'ask_user', question: 'Не нашёл релевантную ссылку. Уточните, что открыть.' };
    if (match.candidateTargets.length > 1) return { type: 'ask_user', question: 'Есть несколько подходящих ссылок. Какую открыть?' };
    return { type: 'click', targetId: match.candidateTargets[0] };
  }
}
