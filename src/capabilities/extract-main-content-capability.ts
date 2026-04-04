import { includesAnyNeedle } from '../utils/text.js';
import type { AgentAction } from '../types/actions.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

export class ExtractMainContentCapability implements Capability {
  name = 'ExtractMainContentCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = context.userGoal.toLowerCase();
    if (!includesAnyNeedle(goal, ['extract', 'text', 'извлеч', 'текст'])) return null;

    const containers = context.pageState.interactiveElements.filter((element) =>
      ['main', 'article', 'body'].includes(element.tag) || element.role === 'main',
    );

    if (containers.length === 0) return { confidence: 0.45, reason: 'No main container, fallback to body', candidateTargets: ['body'] };

    const sorted = containers.sort((a, b) => b.text.length - a.text.length);
    return {
      confidence: containers.length > 1 ? 0.58 : 0.88,
      reason: containers.length > 1 ? 'Multiple similar content containers' : 'Single content container',
      candidateTargets: [sorted[0].id, ...sorted.slice(1).map((c) => c.id)],
    };
  }

  plan(_: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) {
      return { type: 'extract_text', targetId: 'body' };
    }
    if (match.candidateTargets.length > 1 && match.confidence < 0.6) {
      return { type: 'ask_user', question: 'На странице несколько похожих блоков текста. Какой извлечь?' };
    }
    return { type: 'extract_text', targetId: match.candidateTargets[0] };
  }
}
