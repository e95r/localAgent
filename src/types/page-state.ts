export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ElementType = 'button' | 'link' | 'input' | 'textarea' | 'dialog' | 'modal' | 'container';

export interface InteractiveElement {
  id: string;
  tag: string;
  role: string | null;
  elementType: ElementType;
  text: string;
  ariaLabel: string | null;
  placeholder: string | null;
  href: string | null;
  value: string | null;
  visible: boolean;
  enabled: boolean;
  clickable: boolean;
  boundingBox: BoundingBox | null;
  selectorHint: string;
  nearestTextContext: string;
  containerHint: string | null;
  isLikelyOverlay: boolean;
  isLikelyPrimaryAction: boolean;
  domSnippet: string;
}

export interface PageState {
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: InteractiveElement[];
}
