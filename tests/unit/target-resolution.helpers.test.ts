import { describe, expect, it } from 'vitest';
import { makeElement } from './helpers.js';
import { resolveClickableTargetIdFromElements, resolveTargetIdFromElements } from '../target-resolution.helpers.js';

describe('target resolution helpers', () => {
  it('text match for Primary download returns clickable anchor, not body', () => {
    const elements = [
      makeElement({ id: 'body', tag: 'body', elementType: 'container', text: 'Primary download Secondary download', clickable: false }),
      makeElement({ id: 'primary-link', tag: 'a', elementType: 'link', text: 'Primary download', href: '/primary', clickable: true }),
    ];

    const targetId = resolveClickableTargetIdFromElements(elements, (el) => String(el.text ?? '').includes('Primary download'));
    expect(targetId).toBe('primary-link');
  });

  it('text match for Installation guide returns anchor, not body', () => {
    const elements = [
      makeElement({ id: 'main-container', tag: 'main', elementType: 'container', text: 'Installation guide and references', clickable: false }),
      makeElement({ id: 'install-link', tag: 'a', elementType: 'link', text: 'Installation guide', href: '/install', clickable: true }),
    ];

    const targetId = resolveClickableTargetIdFromElements(elements, (el) => String(el.text ?? '').includes('Installation guide'));
    expect(targetId).toBe('install-link');
  });

  it('text match for 2026-04 latest returns anchor, not body', () => {
    const elements = [
      makeElement({ id: 'article-container', tag: 'article', elementType: 'container', text: '2026-04 latest release summary', clickable: false }),
      makeElement({ id: 'latest-link', tag: 'a', elementType: 'link', text: '2026-04 latest', href: '/item-2026-04', clickable: true }),
    ];

    const targetId = resolveClickableTargetIdFromElements(elements, (el) => String(el.text ?? '').includes('2026-04 latest'));
    expect(targetId).toBe('latest-link');
  });

  it('generic target resolution can still resolve main/article for extract flows', () => {
    const elements = [
      makeElement({ id: 'page-body', tag: 'body', elementType: 'container', text: 'whole page text', clickable: false }),
      makeElement({ id: 'main-content', tag: 'main', elementType: 'container', text: 'main content', clickable: false }),
      makeElement({ id: 'article-content', tag: 'article', elementType: 'container', text: 'article content', clickable: false }),
    ];

    const mainId = resolveTargetIdFromElements(elements, (el) => el.tag === 'main');
    const articleId = resolveTargetIdFromElements(elements, (el) => el.tag === 'article');

    expect(mainId).toBe('main-content');
    expect(articleId).toBe('article-content');
  });
});
