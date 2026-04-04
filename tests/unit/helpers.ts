import type { InteractiveElement, PageState } from '../../src/types/page-state.js';

export function makeElement(overrides: Partial<InteractiveElement> = {}): InteractiveElement {
  return {
    id: 'el-1',
    tag: 'button',
    role: null,
    elementType: 'button',
    text: 'Button',
    ariaLabel: null,
    placeholder: null,
    href: null,
    value: null,
    visible: true,
    enabled: true,
    clickable: true,
    boundingBox: null,
    selectorHint: '#el',
    nearestTextContext: '',
    containerHint: null,
    isLikelyOverlay: false,
    isLikelyPrimaryAction: false,
    domSnippet: '<button />',
    ...overrides,
  };
}

export function makeState(interactiveElements: InteractiveElement[]): PageState {
  return { url: 'http://x', title: 'x', visibleText: '', interactiveElements };
}
