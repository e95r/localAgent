import type { AgentAction } from '../types/actions.js';
import { includesAnyNeedle } from '../utils/text.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

const DOWNLOAD_KEYWORDS = ['download', 'скачать', 'export', 'pdf'];

export class DownloadCapability implements Capability {
  name = 'DownloadCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const goal = context.userGoal.toLowerCase();
    if (!includesAnyNeedle(goal, DOWNLOAD_KEYWORDS)) return null;

    const candidates = context.pageState.interactiveElements.filter((element) =>
      element.visible &&
      element.enabled &&
      element.clickable &&
      includesAnyNeedle(`${element.text} ${element.ariaLabel ?? ''} ${element.href ?? ''}`, DOWNLOAD_KEYWORDS),
    );

    if (candidates.length === 0) {
      return { confidence: 0.2, reason: 'Download intent detected but no enabled target found' };
    }

    const confidence = candidates.length === 1 ? 0.92 : 0.48;
    return {
      confidence,
      reason: candidates.length === 1 ? 'Single download candidate' : 'Multiple download candidates',
      candidateTargets: candidates.map((candidate) => candidate.id),
    };
  }

  plan(_: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) {
      return { type: 'ask_user', question: 'Не нашёл доступную кнопку скачивания. Уточните действие.' };
    }
    if (match.candidateTargets.length > 1) {
      return { type: 'ask_user', question: 'Найдено несколько кнопок скачивания. Какую выбрать?' };
    }
    return { type: 'click', targetId: match.candidateTargets[0] };
  }
}
