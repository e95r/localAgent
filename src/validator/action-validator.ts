import type { AgentAction } from '../types/actions.js';
import type { PageState } from '../types/page-state.js';
import { getTargetById } from '../utils/target-map.js';

export interface ActionValidator {
  validate(action: AgentAction, pageState: PageState): void;
}

export class DefaultActionValidator implements ActionValidator {
  validate(action: AgentAction, pageState: PageState): void {
    if (action.type === 'ask_user' || action.type === 'finish') {
      return;
    }

    if (action.type === 'extract_text' && action.targetId === 'body') {
      return;
    }

    const target = getTargetById(action.targetId, pageState.interactiveElements);

    if (!target.visible) {
      throw new Error(`Target '${action.targetId}' is not visible`);
    }

    if (action.type === 'click') {
      const isClickable = target.tag === 'button' || target.tag === 'a' || target.role === 'button' || target.role === 'link';
      if (!isClickable || !target.enabled) {
        throw new Error(`Target '${action.targetId}' is not clickable`);
      }
    }

    if (action.type === 'type') {
      const canType = ['input', 'textarea'].includes(target.tag);
      if (!canType || !target.enabled) {
        throw new Error(`Target '${action.targetId}' is not typable`);
      }
    }
  }
}
