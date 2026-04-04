import type { PageState } from '../types/page-state.js';
import { normalizeText } from '../utils/text.js';

export function normalizePageState(state: PageState): PageState {
  return {
    ...state,
    title: normalizeText(state.title),
    visibleText: normalizeText(state.visibleText),
    interactiveElements: state.interactiveElements.map((element) => ({
      ...element,
      text: normalizeText(element.text),
      nearestTextContext: normalizeText(element.nearestTextContext),
      domSnippet: element.domSnippet.slice(0, 220),
    })),
  };
}
