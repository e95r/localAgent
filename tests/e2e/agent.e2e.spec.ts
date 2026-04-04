import { test, expect } from '@playwright/test';
import { createFixtureServer } from '../test-server.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { BrowserAgent } from '../../src/agent/agent.js';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => closeServer?.());

function makeAgent(executor: PlaywrightBrowserExecutor, debugArtifacts?: { enabled: boolean; outputDir: string }) {
  return new BrowserAgent({ executor, observer: new DOMPageObserver(), planner: new RuleBasedPlanner(), validator: new DefaultActionValidator(), debugArtifacts });
}

test('popup is closed and then download starts', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  await agent.run('download pdf', `${baseUrl}/popup-download.html`, 3);
  const state = await new DOMPageObserver().collect(executor.getPage());
  expect(state.interactiveElements.find((e) => e.text.includes('Download'))?.visible).toBeTruthy();
  await executor.close();
});

test('search input is filled, submitted, and first relevant result is opened', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  await agent.run('search "cats" and open first link', `${baseUrl}/search-page.html`, 5);
  expect(await executor.getCurrentUrl()).toContain('/next1');
  await executor.close();
});

test('select last list item and open it', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  await agent.run('open last item', `${baseUrl}/list-page.html`, 2);
  expect(await executor.getCurrentUrl()).toContain('/next3');
  await executor.close();
});

test('extract main text from page with several content blocks', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  const result = await agent.run('extract text', `${baseUrl}/multi-article-page.html`, 2);
  expect(result.some((step) => step.action.type === 'ask_user' || step.extractedText)).toBeTruthy();
  await executor.close();
});

test('disabled download is not clicked', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  await expect(agent.run('download file', `${baseUrl}/disabled-download-page.html`, 2)).rejects.toThrow();
  await executor.close();
});

test('ambiguous search field causes ask_user', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor);
  const steps = await agent.run('search docs', `${baseUrl}/ambiguous-search-page.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  await executor.close();
});

test('invalid targetId is rejected', async () => {
  const validator = new DefaultActionValidator();
  expect(() => validator.validate({ type: 'click', targetId: 'invalid' }, { url: 'x', title: 'x', visibleText: '', interactiveElements: [] })).toThrow(/not found/);
});

test('debug artifacts are created on ambiguity/failure', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-e2e-debug-'));
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeAgent(executor, { enabled: true, outputDir: dir });
  await agent.run('search docs', `${baseUrl}/ambiguous-search-page.html`, 2);
  const folders = await readdir(dir);
  expect(folders.length).toBeGreaterThan(0);
  await executor.close();
  await rm(dir, { recursive: true, force: true });
});
