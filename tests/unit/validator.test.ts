import { describe, expect, it } from 'vitest';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import type { PageState } from '../../src/types/page-state.js';

const validator = new DefaultActionValidator();

const baseState: PageState = {
  url: 'http://test',
  title: 't',
  visibleText: '',
  interactiveElements: [
    { id: 'btn', tag: 'button', role: null, text: 'Go', ariaLabel: null, href: null, visible: true, enabled: true, boundingBox: null, selectorHint: '#btn', domSnippet: '' },
    { id: 'inp', tag: 'input', role: null, text: '', ariaLabel: null, href: null, visible: true, enabled: true, boundingBox: null, selectorHint: '#inp', domSnippet: '' },
  ],
};

describe('DefaultActionValidator', () => {
  it('accepts valid click', () => {
    expect(() => validator.validate({ type: 'click', targetId: 'btn' }, baseState)).not.toThrow();
  });

  it('rejects invalid target', () => {
    expect(() => validator.validate({ type: 'click', targetId: 'none' }, baseState)).toThrow(/not found/);
  });

  it('rejects type on button', () => {
    expect(() => validator.validate({ type: 'type', targetId: 'btn', text: 'a' }, baseState)).toThrow(/not typable/);
  });
});
