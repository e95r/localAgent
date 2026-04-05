import { describe, expect, it } from 'vitest';
import { ScenarioRunner } from '../../src/replay/scenario-runner.js';
import type { Scenario } from '../../src/scenario/types.js';
import { makeElement, makeState } from './helpers.js';

const scenario: Scenario = {
  schemaVersion: '1.0.0',
  id: 's',
  name: 'approval',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metadata: { sourceUrl: 'http://x', startUrl: 'http://x' },
  steps: [{ stepId: 'st1', action: { actionType: 'click' }, pageUrlAtRecordTime: 'http://x', target: { strictSelectors: ['#ok'], fallbackSelectors: [] } }],
};

describe('scenario runner approval integration', () => {
  it('rejecting approval aborts safely', async () => {
    const targetLocator = {
      count: async () => 1,
      evaluate: async () => 'target-1',
      click: async () => {},
      isVisible: async () => false,
      textContent: async () => '',
      fill: async () => {},
      press: async () => {},
      isEnabled: async () => true,
    };
    const emptyLocator = {
      count: async () => 0,
      first: () => emptyLocator,
      nth: () => emptyLocator,
      locator: () => emptyLocator,
      isVisible: async () => false,
      textContent: async () => '',
      click: async () => {},
      evaluate: async () => '',
      fill: async () => {},
      press: async () => {},
      isEnabled: async () => false,
    };
    const page = {
      locator: (selector: string) => {
        if (selector === '#ok') return { first: () => targetLocator };
        return emptyLocator;
      },
      waitForTimeout: async () => {},
    };
    const runner = new ScenarioRunner({
      executor: { openUrl: async () => {}, getPage: () => page, waitForPageSettled: async () => {}, getCurrentUrl: async () => 'http://x' } as any,
      observer: { collect: async () => makeState([makeElement({ id: 'target-1' })]) } as any,
      validator: { validate: () => {} } as any,
    });

    const result = await runner.runScenario(scenario, { mode: 'strict', approvalHandler: async () => ({ approved: false, outcome: 'rejected' }) });
    expect(result.success).toBe(false);
    expect(result.steps[0].approvalOutcome).toBe('rejected');
  });
});
