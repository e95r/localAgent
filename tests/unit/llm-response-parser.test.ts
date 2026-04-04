import { describe, expect, it } from 'vitest';
import { parseLlmPlannerResponse } from '../../src/llm/llm-response-parser.js';

describe('llm response parser', () => {
  it('parses valid JSON', () => {
    const parsed = parseLlmPlannerResponse(JSON.stringify({
      selectedCapabilityName: 'DownloadCapability',
      action: 'click',
      targetId: 'el-1',
      confidence: 0.9,
      reason: 'best match',
      candidateTargets: ['el-1'],
    }));
    expect(parsed.action).toBe('click');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseLlmPlannerResponse('{bad')).toThrow(/Invalid JSON/);
  });

  it('rejects missing fields and unknown action', () => {
    expect(() => parseLlmPlannerResponse(JSON.stringify({ action: 'boom' }))).toThrow(/Unknown action/);
    expect(() => parseLlmPlannerResponse(JSON.stringify({
      selectedCapabilityName: 'X',
      action: 'click',
      confidence: 0.1,
      reason: 'x',
      candidateTargets: [],
    }))).toThrow(/targetId/);
  });
});
