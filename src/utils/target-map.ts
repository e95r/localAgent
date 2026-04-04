import type { InteractiveElement } from '../types/page-state.js';

export function mapTargetIdToSelector(
  targetId: string,
  elements: InteractiveElement[],
): string {
  const match = elements.find((element) => element.id === targetId);
  if (!match) {
    throw new Error(`Target with id '${targetId}' not found in page state`);
  }
  return match.selectorHint;
}

export function getTargetById(
  targetId: string,
  elements: InteractiveElement[],
): InteractiveElement {
  const match = elements.find((element) => element.id === targetId);
  if (!match) {
    throw new Error(`Target with id '${targetId}' not found in page state`);
  }
  return match;
}
