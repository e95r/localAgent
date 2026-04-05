import { test, expect } from '@playwright/test';
import { createFixtureServer } from '../test-server.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { ScenarioRecorder } from '../../src/recorder/scenario-recorder.js';
import { ScenarioRunner } from '../../src/replay/scenario-runner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import type { Scenario } from '../../src/scenario/types.js';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

const observer = new DOMPageObserver();

test.beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => closeServer?.());

test('record stable click scenario and replay strict successfully', async () => {
  const executor = new PlaywrightBrowserExecutor();
  await executor.openUrl(`${baseUrl}/replay-stable-page.html`);
  const state = await observer.collect(executor.getPage());
  const link = state.interactiveElements.find((el) => el.selectorHint === '#details-link');
  if (!link) throw new Error('missing link');

  const recorder = new ScenarioRecorder();
  recorder.startRecording('stable click', `${baseUrl}/replay-stable-page.html`);
  recorder.recordStep({ actionType: 'click', pageState: state, target: link, postActionExpectation: { urlIncludes: '/article.html' } });

  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(recorder.stopRecording(), { mode: 'strict' });
  expect(result.success).toBeTruthy();
  await executor.close();
});

test('record stable text extraction scenario and replay strict successfully', async () => {
  const executor = new PlaywrightBrowserExecutor();
  await executor.openUrl(`${baseUrl}/replay-article-page.html`);
  const state = await observer.collect(executor.getPage());
  const article = state.interactiveElements.find((el) => el.selectorHint === '#article-main');
  if (!article) throw new Error('missing article');

  const recorder = new ScenarioRecorder();
  recorder.startRecording('extract', `${baseUrl}/replay-article-page.html`);
  recorder.recordStep({ actionType: 'extract_text', pageState: state, target: article, postActionExpectation: { extractedNonEmpty: true } });
  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(recorder.stopRecording(), { mode: 'strict' });
  expect(result.steps[0].extractedText).toContain('replay article');
  await executor.close();
});

test('replay adaptive succeeds on replay-shifted-page.html', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const scenario: Scenario = {
    schemaVersion: '1.0.0',
    id: 'e2e-shift',
    name: 'shift',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: `${baseUrl}/replay-shifted-page.html`, startUrl: `${baseUrl}/replay-shifted-page.html` },
    steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#search-btn'], fallbackSelectors: ['button[aria-label="Search"]'], text: 'Search', ariaLabel: 'Search' }, postActionExpectation: { textVisible: 'Search complete' } }],
  };

  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(scenario, { mode: 'adaptive' });
  expect(result.success).toBeTruthy();
  await executor.close();
});

test('replay adaptive asks_user on replay-broken-page.html', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const scenario: Scenario = {
    schemaVersion: '1.0.0',
    id: 'e2e-broken',
    name: 'broken',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: `${baseUrl}/replay-broken-page.html`, startUrl: `${baseUrl}/replay-broken-page.html` },
    steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#search-btn'], fallbackSelectors: [], text: 'Search' } }],
  };

  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(scenario, { mode: 'adaptive' });
  expect(result.steps[0].strategy).toBe('ask-user');
  await executor.close();
});

test('replay strict fails safely when selector no longer exists', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const scenario: Scenario = {
    schemaVersion: '1.0.0',
    id: 'e2e-strict-fail',
    name: 'strict fail',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: `${baseUrl}/replay-shifted-page.html`, startUrl: `${baseUrl}/replay-shifted-page.html` },
    steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#search-btn'], fallbackSelectors: ['#go'] } }],
  };
  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(scenario, { mode: 'strict' });
  expect(result.success).toBeFalsy();
  await executor.close();
});

test('download scenario can be recorded and replayed', async () => {
  const executor = new PlaywrightBrowserExecutor();
  await executor.openUrl(`${baseUrl}/replay-download-page.html`);
  const state = await observer.collect(executor.getPage());
  const download = state.interactiveElements.find((el) => el.selectorHint === '#download-link');
  if (!download) throw new Error('missing download');

  const recorder = new ScenarioRecorder();
  recorder.startRecording('download', `${baseUrl}/replay-download-page.html`);
  recorder.recordStep({ actionType: 'click', pageState: state, target: download, postActionExpectation: { fileDownloadExpected: true } });
  const result = await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(recorder.stopRecording(), { mode: 'strict' });
  expect(result.success).toBeTruthy();
  await executor.close();
});

test('replay artifacts are created on mismatch/failure', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'e2e-replay-artifacts-'));
  const executor = new PlaywrightBrowserExecutor();
  const scenario: Scenario = {
    schemaVersion: '1.0.0',
    id: 'e2e-artifacts',
    name: 'artifacts',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: `${baseUrl}/replay-stable-page.html`, startUrl: `${baseUrl}/replay-stable-page.html` },
    steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#missing'], fallbackSelectors: [] } }],
  };

  await new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() }).runScenario(scenario, { mode: 'strict', debugArtifacts: { enabled: true, outputDir: dir } });
  const dirs = await readdir(dir);
  expect(dirs.length).toBeGreaterThan(0);
  await executor.close();
  await rm(dir, { recursive: true, force: true });
});
