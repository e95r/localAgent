import { test, expect } from '@playwright/test';
import { createFixtureServer } from '../test-server.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { BrowserAgent } from '../../src/agent/agent.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => {
  await closeServer?.();
});

test('download scenario', async () => {
  const executor = new PlaywrightBrowserExecutor();
  await executor.openUrl(`${baseUrl}/download.html`);

  const observer = new DOMPageObserver();
  const state = await observer.collect(executor.getPage());
  const target = state.interactiveElements.find((e) => e.text.includes('Download'));

  expect(target).toBeTruthy();

  const download = await executor.downloadFile(async () => {
    await executor.clickElement('#download-link');
  });

  expect(download.suggestedFilename()).toContain('mock');
  await executor.close();
});

test('extract article text', async () => {
  const executor = new PlaywrightBrowserExecutor();
  await executor.openUrl(`${baseUrl}/article.html`);
  const text = await executor.extractText('article');
  expect(text).toContain('local article fixture');
  await executor.close();
});

test('open first link through agent loop', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = new BrowserAgent({
    executor,
    observer: new DOMPageObserver(),
    planner: new RuleBasedPlanner(),
    validator: new DefaultActionValidator(),
  });

  await agent.run('открыть первую ссылку', `${baseUrl}/links.html`, 1);
  expect(await executor.getCurrentUrl()).toContain('/next1');
  await executor.close();
});

test('ambiguous buttons lead to ask_user', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = new BrowserAgent({
    executor,
    observer: new DOMPageObserver(),
    planner: new RuleBasedPlanner(),
    validator: new DefaultActionValidator(),
  });

  const steps = await agent.run('скачать файл', `${baseUrl}/ambiguous.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  await executor.close();
});

test('invalid targetId is rejected by validator', async () => {
  const validator = new DefaultActionValidator();
  expect(() =>
    validator.validate(
      { type: 'click', targetId: 'invalid' },
      { url: 'x', title: 'x', visibleText: '', interactiveElements: [] },
    ),
  ).toThrow(/not found/);
});
