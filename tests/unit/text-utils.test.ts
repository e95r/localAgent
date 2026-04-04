import { describe, expect, it } from 'vitest';
import { normalizeText } from '../../src/utils/text.js';

describe('normalizeText', () => {
  it('normalizes whitespace', () => {
    expect(normalizeText(' a\n   b   c ')).toBe('a b c');
  });

  it('returns empty for whitespace only', () => {
    expect(normalizeText('   \n  ')).toBe('');
  });

  it('keeps unicode letters', () => {
    expect(normalizeText('Скачать   PDF')).toBe('Скачать PDF');
  });
});
