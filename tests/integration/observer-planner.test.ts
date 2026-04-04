import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { createFixtureServer } from '../test-server.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

describe('observer + capability registry + planner integration', () => {
  beforeAll(async () => {
    const server = await createFixtureServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });
  afterAll(async () => closeServer?.());

  it('popup detected before download', async () => {
    const executor = new PlaywrightBrowserExecutor();
    await executor.openUrl(`${baseUrl}/popup-download.html`);
    const state = await new DOMPageObserver().collect(executor.getPage());
    const action = new RuleBasedPlanner().decide({ userGoal: 'скачать pdf', pageState: state, actionHistory: [] });
    expect(action.selectedCapabilityName).toBe('ClosePopupCapability');
    await executor.close();
  });

  it('ambiguous result leads to ask_user', async () => {
    const executor = new PlaywrightBrowserExecutor();
    await executor.openUrl(`${baseUrl}/ambiguous-search-page.html`);
    const state = await new DOMPageObserver().collect(executor.getPage());
    const action = new RuleBasedPlanner().decide({ userGoal: 'search playwright', pageState: state, actionHistory: [] });
    expect(action.type).toBe('ask_user');
    await executor.close();
  });
});
