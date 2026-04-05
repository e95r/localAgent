import { describe, expect, it } from 'vitest';
import { ScenarioRecorder, toTargetSnapshot } from '../../src/recorder/scenario-recorder.js';
import { makeElement, makeState } from './helpers.js';

describe('recorder', () => {
  it('recorder step creation success', () => {
    const recorder = new ScenarioRecorder();
    recorder.startRecording('flow', 'http://x');
    const state = makeState([makeElement({ id: 'el-1', selectorHint: '#go', text: 'Go', tag: 'button', role: 'button' })]);
    const step = recorder.recordStep({ actionType: 'click', pageState: state, target: state.interactiveElements[0] });
    const scenario = recorder.stopRecording();
    expect(step.stepId).toBe('step-1');
    expect(scenario.steps).toHaveLength(1);
  });

  it('snapshot normalization stores strict/fallback selectors', () => {
    const snapshot = toTargetSnapshot(makeElement({ id: 'el-42', selectorHint: '#search', role: 'button', tag: 'button' }));
    expect(snapshot.strictSelectors).toContain('#search');
    expect(snapshot.fallbackSelectors.some((s) => s.includes('data-agent-id'))).toBeTruthy();
  });
});
