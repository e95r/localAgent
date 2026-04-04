import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { createFixtureServer } from '../test-server.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

describe('observer + planner integration', () => {
  beforeAll(async () => {
    const server = await createFixtureServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  afterAll(async () => {
    await closeServer?.();
  });

  it('plans click on download fixture', async () => {
    const executor = new PlaywrightBrowserExecutor();
    await executor.openUrl(`${baseUrl}/download.html`);

    const observer = new DOMPageObserver();
    const planner = new RuleBasedPlanner();

    const state = await observer.collect(executor.getPage());
    const action = planner.decide({ userGoal: 'скачать pdf', pageState: state, actionHistory: [] });

    expect(state.interactiveElements.length).toBeGreaterThan(0);
    expect(action.type).toBe('click');

    await executor.close();
  });
});
