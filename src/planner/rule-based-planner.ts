import type { AgentAction, Planner, PlannerInput } from '../types/actions.js';
import type { InteractiveElement } from '../types/page-state.js';
import { includesAnyNeedle } from '../utils/text.js';

const DOWNLOAD_KEYWORDS = ['download', 'скачать', 'pdf', 'export'];

export class RuleBasedPlanner implements Planner {
  decide(input: PlannerInput): AgentAction {
    const goal = input.userGoal.toLowerCase();

    if (includesAnyNeedle(goal, ['скачать', 'download'])) {
      const candidates = input.pageState.interactiveElements.filter((element) =>
        includesAnyNeedle(`${element.text} ${element.ariaLabel ?? ''} ${element.href ?? ''}`, DOWNLOAD_KEYWORDS),
      );

      if (candidates.length === 1) {
        return { type: 'click', targetId: candidates[0].id, confidence: 0.92, reason: 'Matched download intent' };
      }

      if (candidates.length > 1) {
        return {
          type: 'ask_user',
          question: 'Найдено несколько вариантов скачивания. Какой выбрать?',
          confidence: 0.45,
          reason: 'Ambiguous download targets',
        };
      }

      return { type: 'ask_user', question: 'Не нашёл кнопку скачивания. Уточните действие.', confidence: 0.2 };
    }

    if (includesAnyNeedle(goal, ['скопировать текст', 'copy text', 'extract text'])) {
      const target = findTextContainer(input.pageState.interactiveElements);
      if (target) {
        return { type: 'extract_text', targetId: target.id, confidence: 0.8, reason: 'Text extraction intent' };
      }
      return {
        type: 'extract_text',
        targetId: 'body',
        confidence: 0.6,
        reason: 'Fallback to body extraction',
      };
    }

    if (includesAnyNeedle(goal, ['открыть первую ссылку', 'open first link'])) {
      const firstLink = input.pageState.interactiveElements.find((element) => element.tag === 'a' && element.visible);
      if (firstLink) {
        return { type: 'click', targetId: firstLink.id, confidence: 0.86, reason: 'First visible link' };
      }
      return { type: 'ask_user', question: 'На странице нет ссылок для открытия.', confidence: 0.3 };
    }

    return {
      type: 'ask_user',
      question: 'Недостаточно уверенности для действия. Уточните цель.',
      confidence: 0.1,
      reason: 'No matching rule',
    };
  }
}

function findTextContainer(elements: InteractiveElement[]): InteractiveElement | undefined {
  return elements.find((element) => ['main', 'article', 'body'].includes(element.tag));
}
