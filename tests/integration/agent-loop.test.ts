import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserAgent } from '../../src/agent/agent.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { createFixtureServer } from '../test-server.js';
import type { AgentAction, Planner } from '../../src/types/actions.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

describe('planner + validator + executor + loop', () => {
  beforeAll(async () => {
    const server = await createFixtureServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });
  afterAll(async () => closeServer?.());

  it('fill search + submit search then open first result', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner: new RuleBasedPlanner(), validator: new DefaultActionValidator() });
    await agent.run('search "cats" and open first link', `${baseUrl}/search-page.html`, 4);
    expect(await executor.getCurrentUrl()).toContain('/next1');
    await executor.close();
  });

  it('disabled download leads to ask_user (safe no-click)', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner: new RuleBasedPlanner(), validator: new DefaultActionValidator() });
    const steps = await agent.run('download', `${baseUrl}/disabled-download-page.html`, 2);
    expect(steps.at(-1)?.action.type).toBe('ask_user');
    await executor.close();
  });


  it('loop protection / max step handling', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner: new RuleBasedPlanner(), validator: new DefaultActionValidator() });
    const steps = await agent.run('download', `${baseUrl}/stubborn-download.html`, 5);
    expect(steps.at(-1)?.action.type).toBe('ask_user');
    await executor.close();
  });

  it('debug artifacts are written on ask_user', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-debug-'));
    const executor = new PlaywrightBrowserExecutor();
    const agent = new BrowserAgent({
      executor,
      observer: new DOMPageObserver(),
      planner: new RuleBasedPlanner(),
      validator: new DefaultActionValidator(),
      debugArtifacts: { enabled: true, outputDir: dir },
    });

    await agent.run('search', `${baseUrl}/ambiguous-search-page.html`, 2);
    const folders = await readdir(dir);
    expect(folders.length).toBeGreaterThan(0);
    await executor.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('submit_search with one-step navigation path correctly settles page', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const planner: Planner = {
      decide: ({ pageState }) => {
        const target = pageState.interactiveElements.find((el) => el.selectorHint === '#go-btn');
        if (!target) throw new Error('submit button not found');
        const action: AgentAction = { type: 'submit_search', mode: 'button', targetId: target.id, plannerSource: 'rule-based' };
        return action;
      },
    };
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    await agent.run('go', `${baseUrl}/submit-search-navigation.html`, 1);
    expect(await executor.getCurrentUrl()).toContain('/install');
    await executor.close();
  });

  it('non-navigation click does not break loop', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const planner: Planner = {
      decide: ({ pageState }) => {
        const target = pageState.interactiveElements.find((el) => String(el.text ?? '').includes('Open modal'));
        if (!target) throw new Error('open modal button not found');
        const action: AgentAction = { type: 'click', targetId: target.id, plannerSource: 'rule-based' };
        return action;
      },
    };
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    const steps = await agent.run('open modal', `${baseUrl}/modal.html`, 1);
    expect(steps).toHaveLength(1);
    expect(await executor.getCurrentUrl()).toContain('/modal.html');
    await executor.close();
  });
});
