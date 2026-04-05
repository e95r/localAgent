import type { InteractiveElement } from '../src/types/page-state.js';
import { DOMPageObserver } from '../src/observer/page-observer.js';
import { PlaywrightBrowserExecutor } from '../src/executor/browser-executor.js';

export type ElementPredicate = (element: InteractiveElement) => boolean;

function isClickableTarget(element: InteractiveElement): boolean {
  return element.clickable && element.visible && element.enabled;
}

export function resolveTargetIdFromElements(elements: InteractiveElement[], predicate: ElementPredicate): string {
  const target = elements.find(predicate);
  if (!target) {
    throw new Error('Could not resolve target id from collected page elements');
  }
  return target.id;
}

export function resolveClickableTargetIdFromElements(elements: InteractiveElement[], predicate: ElementPredicate): string {
  const target = elements.find((element) => isClickableTarget(element) && predicate(element));
  if (!target) {
    throw new Error('Could not resolve clickable target id from collected page elements');
  }
  return target.id;
}

export async function resolveTargetId(
  executor: PlaywrightBrowserExecutor,
  observer: DOMPageObserver,
  url: string,
  predicate: ElementPredicate,
): Promise<string> {
  await executor.openUrl(url);
  const state = await observer.collect(executor.getPage());
  return resolveTargetIdFromElements(state.interactiveElements, predicate);
}

export async function resolveClickableTargetId(
  executor: PlaywrightBrowserExecutor,
  observer: DOMPageObserver,
  url: string,
  predicate: ElementPredicate,
): Promise<string> {
  await executor.openUrl(url);
  const state = await observer.collect(executor.getPage());
  return resolveClickableTargetIdFromElements(state.interactiveElements, predicate);
}
