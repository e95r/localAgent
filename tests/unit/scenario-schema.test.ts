import { describe, expect, it } from 'vitest';
import { assertKnownReplayMode, validateScenarioSchema } from '../../src/scenario/schema.js';
import type { Scenario } from '../../src/scenario/types.js';

function makeScenario(): Scenario {
  return {
    schemaVersion: '1.0.0',
    id: 's1',
    name: 'test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: 'http://x', startUrl: 'http://x' },
    steps: [{ stepId: '1', action: { actionType: 'click' }, pageUrlAtRecordTime: 'http://x', target: { strictSelectors: ['#a'], fallbackSelectors: ['button'] } }],
  };
}

describe('scenario schema', () => {
  it('valid scenario JSON loads correctly', () => {
    const scenario = validateScenarioSchema(makeScenario());
    expect(scenario.id).toBe('s1');
  });

  it('invalid scenario JSON is rejected', () => {
    const invalid = { ...makeScenario(), steps: [{ stepId: '1', action: { actionType: 'boom' }, pageUrlAtRecordTime: 'http://x' }] };
    expect(() => validateScenarioSchema(invalid)).toThrow(/invalid actionType/);
  });

  it('unknown replay mode handling throws', () => {
    expect(() => assertKnownReplayMode('unknown')).toThrow(/Unknown replay mode/);
  });
});
