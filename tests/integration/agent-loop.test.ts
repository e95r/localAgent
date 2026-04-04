import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BrowserAgent } from '../../src/agent/agent.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { createFixtureServer } from '../test-server.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

describe('planner + validator + executor + loop', () => {
  beforeAll(async () => {
    const server = await createFixtureServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });

  afterAll(async () => {
    await closeServer?.();
  });

  it('returns ask_user on ambiguous page', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const agent = new BrowserAgent({
      executor,
      observer: new DOMPageObserver(),
      planner: new RuleBasedPlanner(),
      validator: new DefaultActionValidator(),
    });

    const result = await agent.run('скачать файл', `${baseUrl}/ambiguous.html`, 2);
    expect(result.at(-1)?.action.type).toBe('ask_user');

    await executor.close();
  });
});
