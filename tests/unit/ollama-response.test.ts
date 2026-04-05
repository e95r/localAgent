import { describe, expect, it } from 'vitest';
import { extractFirstJsonObject, extractOllamaModelText, sanitizeModelText } from '../../src/llm/ollama-response.js';

describe('ollama response helpers', () => {
  it('extracts valid model text', () => {
    expect(extractOllamaModelText({ response: '{"ok":true}' })).toBe('{"ok":true}');
    expect(extractOllamaModelText({ message: { content: '{"ok":true}' } })).toBe('{"ok":true}');
  });

  it('cleans fenced json and surrounding text', () => {
    const cleaned = sanitizeModelText('prefix\n```json\n{"action":"click"}\n```\nsuffix');
    expect(cleaned).toBe('{"action":"click"}');
  });

  it('handles truncated json and malformed payloads', () => {
    expect(extractFirstJsonObject('text {"a":1')).toBe('{"a":1');
    expect(() => extractOllamaModelText({ response: '' })).toThrow(/Empty/);
    expect(() => extractOllamaModelText({ nope: true })).toThrow(/unexpected/);
  });
});
