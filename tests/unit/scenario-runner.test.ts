import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScenarioRunner } from '../../src/replay/scenario-runner.js';
import type { Scenario } from '../../src/scenario/types.js';
import { makeElement, makeState } from './helpers.js';

function makeScenario(): Scenario {
  return {
    schemaVersion: '1.0.0',
    id: 's',
    name: 'runner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: 'http://x', startUrl: 'http://x' },
    steps: [{ stepId: 'st1', action: { actionType: 'click' }, pageUrlAtRecordTime: 'http://x', target: { strictSelectors: ['#missing'], fallbackSelectors: [] } }],
  };
}

describe('scenario runner', () => {
  it('strict mode does not silently fallback to semantic guessing', async () => {
    const page = {
      locator: () => ({ first: () => ({ count: async () => 0 }) }),
    };
    const runner = new ScenarioRunner({
      executor: { openUrl: async () => {}, getPage: () => page } as any,
      observer: { collect: async () => makeState([makeElement()]) } as any,
      validator: { validate: () => {} } as any,
    });
    const result = await runner.runScenario(makeScenario(), { mode: 'strict' });
    expect(result.success).toBeFalsy();
    expect(result.steps[0].strategy).toBe('ask-user');
  });

  it('missing target leads to ask_user fail safely', async () => {
    const scenario = makeScenario();
    const runner = new ScenarioRunner({
      executor: { openUrl: async () => {}, getPage: () => ({ locator: () => ({ first: () => ({ count: async () => 0 }) }) }) } as any,
      observer: { collect: async () => makeState([makeElement()]) } as any,
      validator: { validate: () => {} } as any,
    });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeFalsy();
    expect(result.steps[0].strategy).toBe('ask-user');
  });

  it('replay debug artifacts are created on failure', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'replay-artifacts-'));
    const runner = new ScenarioRunner({
      executor: { openUrl: async () => {}, getPage: () => ({ locator: () => ({ first: () => ({ count: async () => 0 }) }) }) } as any,
      observer: { collect: async () => makeState([makeElement()]) } as any,
      validator: { validate: () => {} } as any,
    });

    await runner.runScenario(makeScenario(), { mode: 'strict', debugArtifacts: { enabled: true, outputDir: dir } });
    const dirs = await readdir(dir);
    expect(dirs.length).toBeGreaterThan(0);
    await rm(dir, { recursive: true, force: true });
  });

  it('rebuilds state and validates with matched selector when resolved locator has no data-agent-id', async () => {
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-no-id',
      name: 'runner no id',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: 'http://x', startUrl: 'http://x' },
      steps: [{
        stepId: 'st1',
        action: { actionType: 'click' },
        pageUrlAtRecordTime: 'http://x',
        target: { strictSelectors: ['#result-link'], fallbackSelectors: ['a[href]'], text: 'Guide middle target', href: '/guide-middle', tag: 'a' },
      }],
    };

    const collectedStates = [
      makeState([makeElement({ id: 'el-old', tag: 'a', selectorHint: '#other', text: 'Other', href: '/other' })]),
      makeState([makeElement({ id: 'el-42', tag: 'a', selectorHint: '#result-link', text: 'Guide middle target', href: '/guide-middle' })]),
    ];

    const validationCalls: string[] = [];
    const firstLocator = {
      count: async () => 1,
      isEnabled: async () => true,
      isVisible: async () => false,
      textContent: async () => '',
      evaluate: async (fn: unknown) => {
        const code = String(fn);
        if (code.includes('data-agent-id')) return '';
        return { tag: 'a', text: 'Guide middle target', href: '/guide-middle', ariaLabel: '', placeholder: '' };
      },
      click: async () => {},
    };

    const makeLocator = (selector: string) => ({
      count: async () => (selector === '#result-link' ? 1 : 0),
      first: () => ({ ...firstLocator, count: async () => (selector === '#result-link' ? 1 : 0) }),
      nth: () => ({ isVisible: async () => false }),
      locator: (nestedSelector: string) => makeLocator(nestedSelector),
    });

    const runner = new ScenarioRunner({
      executor: {
        openUrl: async () => {},
        getPage: () => ({
          waitForTimeout: async () => {},
          locator: (selector: string) => makeLocator(selector),
        }),
        waitForPageSettled: async () => {},
      } as any,
      observer: { collect: async () => collectedStates.shift() ?? makeState([]) } as any,
      validator: { validate: (action) => validationCalls.push((action as { targetId: string }).targetId) } as any,
    });

    const result = await runner.runScenario(scenario, { mode: 'strict' });
    expect(result.steps[0]?.reason).not.toBe('Replay execution failed');
    expect(validationCalls).toEqual(['el-42']);
  });
});
