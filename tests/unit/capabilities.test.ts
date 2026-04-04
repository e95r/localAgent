import { describe, expect, it } from 'vitest';
import { DownloadCapability } from '../../src/capabilities/download-capability.js';
import { ExtractMainContentCapability } from '../../src/capabilities/extract-main-content-capability.js';
import { OpenRelevantLinkCapability } from '../../src/capabilities/open-relevant-link-capability.js';
import { ClosePopupCapability } from '../../src/capabilities/close-popup-capability.js';
import { FillSearchInputCapability } from '../../src/capabilities/fill-search-input-capability.js';
import { SubmitSearchCapability } from '../../src/capabilities/submit-search-capability.js';
import { SelectListItemCapability } from '../../src/capabilities/select-list-item-capability.js';
import { makeElement, makeState } from './helpers.js';

const ctx = (goal: string, elements = [makeElement()]) => ({ userGoal: goal, pageState: makeState(elements), actionHistory: [] as any[] });

describe('Capabilities success/ambiguity/failure', () => {
  it('DownloadCapability success ambiguity failure', () => {
    const cap = new DownloadCapability();
    expect(cap.plan(ctx('download'), cap.canHandle(ctx('download', [makeElement({ id: 'a', text: 'Download' })]))!).type).toBe('click');
    expect(cap.plan(ctx('download'), cap.canHandle(ctx('download', [makeElement({ id: 'a', text: 'Download' }), makeElement({ id: 'b', text: 'Download' })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('download', [makeElement({ text: 'Other', enabled: false })]))?.confidence).toBeLessThan(0.3);
  });

  it('ExtractMainContentCapability success ambiguity failure', () => {
    const cap = new ExtractMainContentCapability();
    expect(cap.plan(ctx('extract text', [makeElement({ id: 'm', tag: 'main', elementType: 'container', clickable: false, text: 'long' })]), cap.canHandle(ctx('extract text', [makeElement({ id: 'm', tag: 'main', elementType: 'container', clickable: false, text: 'long' })]))!).type).toBe('extract_text');
    expect(cap.plan(ctx('extract text', [makeElement({ id: 'a1', tag: 'article', elementType: 'container', clickable: false, text: 'x' }), makeElement({ id: 'a2', tag: 'article', elementType: 'container', clickable: false, text: 'y' })]), cap.canHandle(ctx('extract text', [makeElement({ id: 'a1', tag: 'article', elementType: 'container', clickable: false, text: 'x' }), makeElement({ id: 'a2', tag: 'article', elementType: 'container', clickable: false, text: 'y' })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('open link'))).toBeNull();
  });

  it('OpenRelevantLinkCapability success ambiguity failure', () => {
    const cap = new OpenRelevantLinkCapability();
    expect(cap.plan(ctx('открой первую ссылку', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'One' })]), cap.canHandle(ctx('открой первую ссылку', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'One' })]))!).type).toBe('click');
    expect(cap.plan(ctx('open docs', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'docs api' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link', text: 'docs guide' })]), cap.canHandle(ctx('open docs', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'docs api' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link', text: 'docs guide' })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('open x', []))?.confidence).toBeLessThan(0.3);
  });

  it('ClosePopupCapability success ambiguity-like failure', () => {
    const cap = new ClosePopupCapability();
    expect(cap.plan(ctx('anything', [makeElement({ id: 'ov', isLikelyOverlay: true, clickable: false }), makeElement({ id: 'c', text: 'Close', isLikelyOverlay: true })]), cap.canHandle(ctx('anything', [makeElement({ id: 'ov', isLikelyOverlay: true, clickable: false }), makeElement({ id: 'c', text: 'Close', isLikelyOverlay: true })]))!).type).toBe('click');
    expect(cap.plan(ctx('anything', [makeElement({ id: 'ov', isLikelyOverlay: true, clickable: false })]), cap.canHandle(ctx('anything', [makeElement({ id: 'ov', isLikelyOverlay: true, clickable: false })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('anything', [makeElement({ id: 'x' })]))).toBeNull();
  });

  it('FillSearchInputCapability success ambiguity failure', () => {
    const cap = new FillSearchInputCapability();
    expect(cap.plan(ctx('search "playwright"', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, role: 'searchbox' })]), cap.canHandle(ctx('search "playwright"', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, role: 'searchbox' })]))!).type).toBe('type');
    expect(cap.plan(ctx('search docs', [makeElement({ id: 's1', tag: 'input', elementType: 'input', clickable: false, role: 'searchbox' }), makeElement({ id: 's2', tag: 'input', elementType: 'input', clickable: false, placeholder: 'search' })]), cap.canHandle(ctx('search docs', [makeElement({ id: 's1', tag: 'input', elementType: 'input', clickable: false, role: 'searchbox' }), makeElement({ id: 's2', tag: 'input', elementType: 'input', clickable: false, placeholder: 'search' })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('search docs', []))?.confidence).toBeLessThan(0.4);
    expect(cap.canHandle(ctx('search docs', [makeElement({ tag: 'input', elementType: 'input', clickable: false, role: 'searchbox', value: 'ready' })]))).toBeNull();
  });

  it('SubmitSearchCapability success failure', () => {
    const cap = new SubmitSearchCapability();
    expect(cap.plan(ctx('submit search', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, value: 'abc' }), makeElement({ id: 'b', text: 'Search' })]), cap.canHandle(ctx('submit search', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, value: 'abc' }), makeElement({ id: 'b', text: 'Search' })]))!).type).toBe('submit_search');
    expect(cap.plan(ctx('submit search', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, value: null })]), cap.canHandle(ctx('submit search', [makeElement({ id: 's', tag: 'input', elementType: 'input', clickable: false, value: null })]))!).type).toBe('ask_user');
  });

  it('SelectListItemCapability success ambiguity failure', () => {
    const cap = new SelectListItemCapability();
    const plan = cap.plan(ctx('open last item', [makeElement({ id: 'l1', tag: 'a', elementType: 'link' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link' })]), cap.canHandle(ctx('open last item', [makeElement({ id: 'l1', tag: 'a', elementType: 'link' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link' })]))!);
    expect(plan.type).toBe('click');
    if (plan.type === 'click') expect(plan.targetId).toBe('l2');
    expect(cap.plan(ctx('best docs', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'best docs' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link', text: 'best docs' })]), cap.canHandle(ctx('best docs', [makeElement({ id: 'l1', tag: 'a', elementType: 'link', text: 'best docs' }), makeElement({ id: 'l2', tag: 'a', elementType: 'link', text: 'best docs' })]))!).type).toBe('ask_user');
    expect(cap.canHandle(ctx('last', []))?.confidence).toBeLessThan(0.3);
  });
});
