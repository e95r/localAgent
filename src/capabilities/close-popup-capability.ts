import type { AgentAction } from '../types/actions.js';
import { includesAnyNeedle } from '../utils/text.js';
import type { Capability, CapabilityContext, CapabilityMatch } from './types.js';

const CLOSE_WORDS = ['close', 'закрыть', 'accept', 'continue', '×', 'x'];

export class ClosePopupCapability implements Capability {
  name = 'ClosePopupCapability';

  canHandle(context: CapabilityContext): CapabilityMatch | null {
    const overlays = context.pageState.interactiveElements.filter((element) => element.isLikelyOverlay && element.visible);
    if (!overlays.length) return null;

    const closers = context.pageState.interactiveElements.filter((element) =>
      element.clickable &&
      element.visible &&
      element.enabled &&
      includesAnyNeedle(`${element.text} ${element.ariaLabel ?? ''}`.toLowerCase(), CLOSE_WORDS),
    );

    if (!closers.length) {
      return { confidence: 0.4, reason: 'Popup detected but no reliable close control' };
    }

    return {
      confidence: 0.97,
      reason: 'Popup overlay detected with close control',
      candidateTargets: [closers[0].id],
    };
  }

  plan(_: CapabilityContext, match: CapabilityMatch): AgentAction {
    if (!match.candidateTargets?.length) {
      return { type: 'ask_user', question: 'На странице есть popup, но я не нашёл кнопку закрытия.' };
    }
    return { type: 'click', targetId: match.candidateTargets[0] };
  }
}
