import { describe, expect, it } from 'vitest';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { makeElement, makeState } from './helpers.js';

const validator = new DefaultActionValidator();

describe('DefaultActionValidator', () => {
  it('accepts valid click', () => {
    expect(() => validator.validate({ type: 'click', targetId: 'btn' }, makeState([makeElement({ id: 'btn' })]))).not.toThrow();
  });

  it('rejects invalid target', () => {
    expect(() => validator.validate({ type: 'click', targetId: 'none' }, makeState([]))).toThrow(/not found/);
  });

  it('rejects click when overlay blocks element', () => {
    expect(() =>
      validator.validate(
        { type: 'click', targetId: 'btn' },
        makeState([makeElement({ id: 'btn' }), makeElement({ id: 'overlay', clickable: false, isLikelyOverlay: true })]),
      ),
    ).toThrow(/overlay/);
  });


  it('allows close-popup action even when overlay is present', () => {
    expect(() =>
      validator.validate(
        { type: 'click', targetId: 'close', selectedCapabilityName: 'ClosePopupCapability' },
        makeState([
          makeElement({ id: 'close', isLikelyOverlay: false, clickable: true }),
          makeElement({ id: 'overlay', clickable: false, isLikelyOverlay: true }),
        ]),
      ),
    ).not.toThrow();
  });

  it('rejects submit search when input is empty', () => {
    expect(() => validator.validate({ type: 'submit_search', targetId: 'btn', mode: 'button' }, makeState([makeElement({ id: 'btn' })]))).toThrow(/without filled search/);
  });
});
