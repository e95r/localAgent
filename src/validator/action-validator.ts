import type { AgentAction } from '../types/actions.js';
import type { PageState } from '../types/page-state.js';
import { getTargetById } from '../utils/target-map.js';

export class ValidationError extends Error {}

export interface ActionValidator {
  validate(action: AgentAction, pageState: PageState): void;
}

export class DefaultActionValidator implements ActionValidator {
  validate(action: AgentAction, pageState: PageState): void {
    if (action.type === 'ask_user' || action.type === 'finish') return;
    if (action.type === 'extract_text' && action.targetId === 'body') return;

    const target = getTargetById(action.targetId, pageState.interactiveElements);

    if (!target.visible) throw new ValidationError(`Target '${action.targetId}' is not visible`);
    if (!target.enabled) throw new ValidationError(`Target '${action.targetId}' is disabled`);

    if (action.type === 'click') {
      if (!target.clickable) throw new ValidationError(`Target '${action.targetId}' is not clickable`);
      const overlayPresent = pageState.interactiveElements.some((element) => element.isLikelyOverlay && element.visible);
      const isPopupHandlingAction = action.selectedCapabilityName === 'ClosePopupCapability';
      if (overlayPresent && !target.isLikelyOverlay && !isPopupHandlingAction) {
        throw new ValidationError(`Target '${action.targetId}' is covered by overlay; close popup first`);
      }
    }

    if (action.type === 'type') {
      const canType = ['input', 'textarea'].includes(target.tag);
      if (!canType) throw new ValidationError(`Target '${action.targetId}' is not typable`);
    }

    if (action.type === 'submit_search') {
      const hasFilledInput = pageState.interactiveElements.some((element) =>
        ['input', 'textarea'].includes(element.tag) && !!element.value?.trim(),
      );
      if (!hasFilledInput) {
        throw new ValidationError('Cannot submit search without filled search input');
      }
      if (action.mode === 'button' && !target.clickable) {
        throw new ValidationError(`Target '${action.targetId}' is not clickable`);
      }
    }
  }
}
