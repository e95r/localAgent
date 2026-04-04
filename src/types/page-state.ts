export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InteractiveElement {
  id: string;
  tag: string;
  role: string | null;
  text: string;
  ariaLabel: string | null;
  href: string | null;
  visible: boolean;
  enabled: boolean;
  boundingBox: BoundingBox | null;
  selectorHint: string;
  domSnippet: string;
}

export interface PageState {
  url: string;
  title: string;
  visibleText: string;
  interactiveElements: InteractiveElement[];
}
