import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { ScenarioRecorder } from '../../src/recorder/scenario-recorder.js';
import { ScenarioRunner } from '../../src/replay/scenario-runner.js';
import type { Scenario } from '../../src/scenario/types.js';
import { createFixtureServer } from '../test-server.js';
import { buildSearchWebAndOpenSiteScenario } from '../../src/library/builders/search-web-and-open-site.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

afterAll(async () => closeServer?.());

describe('scenario replay integration', () => {
  it('record simple click flow and replay in strict mode', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    await executor.openUrl(`${baseUrl}/replay-stable-page.html`);
    const state = await observer.collect(executor.getPage());
    const target = state.interactiveElements.find((el) => el.selectorHint === '#details-link');
    if (!target) throw new Error('target missing');

    const recorder = new ScenarioRecorder();
    recorder.startRecording('click flow', `${baseUrl}/replay-stable-page.html`);
    recorder.recordStep({ actionType: 'click', pageState: state, target, postActionExpectation: { urlIncludes: '/article.html' } });
    const scenario = recorder.stopRecording();

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'strict' });
    expect(result.success).toBeTruthy();
    await executor.close();
  });

  it('record search flow and replay in strict mode', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    await executor.openUrl(`${baseUrl}/replay-search-page.html`);
    const state = await observer.collect(executor.getPage());
    const input = state.interactiveElements.find((el) => el.selectorHint === '#search-box');
    const button = state.interactiveElements.find((el) => el.selectorHint === '#submit-search');
    if (!input || !button) throw new Error('search elements missing');

    const recorder = new ScenarioRecorder();
    recorder.startRecording('search flow', `${baseUrl}/replay-search-page.html`);
    recorder.recordStep({ actionType: 'type', pageState: state, target: input, value: 'cats' });
    recorder.recordStep({ actionType: 'submit_search', pageState: state, target: button, mode: 'button', postActionExpectation: { urlIncludes: '/next1' } });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(recorder.stopRecording(), { mode: 'strict' });
    expect(result.success).toBeTruthy();
    await executor.close();
  });

  it('record extract_text flow and replay in strict mode', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    await executor.openUrl(`${baseUrl}/replay-article-page.html`);
    const state = await observer.collect(executor.getPage());
    const target = state.interactiveElements.find((el) => el.selectorHint === '#article-main');
    if (!target) throw new Error('article target missing');

    const recorder = new ScenarioRecorder();
    recorder.startRecording('extract flow', `${baseUrl}/replay-article-page.html`);
    recorder.recordStep({ actionType: 'extract_text', pageState: state, target, postActionExpectation: { extractedNonEmpty: true } });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(recorder.stopRecording(), { mode: 'strict' });
    expect(result.steps[0].extractedText).toContain('replay article');
    await executor.close();
  });

  it('adaptive replay succeeds on shifted DOM version', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();

    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-shift',
      name: 'shift',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: `${baseUrl}/replay-shifted-page.html`, startUrl: `${baseUrl}/replay-shifted-page.html` },
      steps: [{
        stepId: 's1',
        action: { actionType: 'click' },
        pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`,
        target: {
          strictSelectors: ['#search-btn'],
          fallbackSelectors: ['button[aria-label="Search"]'],
          text: 'Search',
          ariaLabel: 'Search',
          tag: 'button',
          role: 'button',
          nearestTextContext: 'Docs Search',
        },
        postActionExpectation: { textVisible: 'Search complete' },
      }],
    };

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeTruthy();
    await executor.close();
  });

  it('adaptive replay asks user on broken page', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-broken',
      name: 'broken',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: `${baseUrl}/replay-broken-page.html`, startUrl: `${baseUrl}/replay-broken-page.html` },
      steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#search-btn'], fallbackSelectors: [], text: 'Search' } }],
    };
    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeFalsy();
    expect(result.steps[0].strategy).toBe('ask-user');
    await executor.close();
  });

  it('planner-assisted adaptive replay works when deterministic matching fails', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-plan',
      name: 'planner fallback',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: `${baseUrl}/replay-shifted-page.html`, startUrl: `${baseUrl}/replay-shifted-page.html` },
      steps: [{
        stepId: 's1',
        action: { actionType: 'click' },
        pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`,
        target: { strictSelectors: ['#missing-target'], fallbackSelectors: [], text: 'not there' },
        postActionExpectation: { textVisible: 'Search complete' },
      }],
    };

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive', plannerAssistedResolver: async () => '#go' });
    expect(result.success).toBeTruthy();
    expect(result.steps[0].strategy).toBe('planner-assisted');
    await executor.close();
  });

  
  it('replay uses validator and rejects unsafe action', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-validator',
      name: 'validator',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: `${baseUrl}/disabled-download-page.html`, startUrl: `${baseUrl}/disabled-download-page.html` },
      steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/disabled-download-page.html`, target: { strictSelectors: ['#download-btn'], fallbackSelectors: [] } }],
    };
    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'strict' });
    expect(result.success).toBeFalsy();
    await executor.close();
  });
it('strict replay fails when exact selector is gone', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's-strict-fail',
      name: 'strict fail',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: `${baseUrl}/replay-shifted-page.html`, startUrl: `${baseUrl}/replay-shifted-page.html` },
      steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${baseUrl}/replay-stable-page.html`, target: { strictSelectors: ['#search-btn'], fallbackSelectors: ['#go'] } }],
    };
    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'strict' });
    expect(result.success).toBeFalsy();
    await executor.close();
  });

  it('library search-web-and-open-site opens the intended organic result', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario = buildSearchWebAndOpenSiteScenario({
      searchUrl: `${baseUrl}/search-engine.html`,
      query: 'IANA example domains',
      targetKeyword: 'IANA',
      targetDomain: 'iana.org',
    });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeTruthy();
    await executor.close();
  });

  it('library search-web-and-open-site ignores sponsored result and opens organic match', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario = buildSearchWebAndOpenSiteScenario({
      searchUrl: `${baseUrl}/search-engine-ads.html`,
      query: 'IANA example domains',
      targetKeyword: 'IANA',
      targetDomain: 'iana.org',
    });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeTruthy();
    expect(result.steps.find((step) => step.stepId === 'step-4-open-result')?.reason).toContain('organic');
    await executor.close();
  });

  it('library search-web-and-open-site remains stable when resolved locator has no data-agent-id', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario = buildSearchWebAndOpenSiteScenario({
      searchUrl: `${baseUrl}/search-engine-ads-no-id.html`,
      query: 'IANA example domains',
      targetKeyword: 'IANA',
      targetDomain: 'iana.org',
    });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeTruthy();
    expect(result.steps.find((step) => step.stepId === 'step-4-open-result')?.reason).toContain('organic');
    await executor.close();
  });

  it('library search-web-and-open-site fails safely when no confident result exists', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const observer = new DOMPageObserver();
    const scenario = buildSearchWebAndOpenSiteScenario({
      searchUrl: `${baseUrl}/search-engine-no-match.html`,
      query: 'IANA example domains',
      targetKeyword: 'IANA',
      targetDomain: 'iana.org',
    });

    const runner = new ScenarioRunner({ executor, observer, validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenario, { mode: 'adaptive' });
    expect(result.success).toBeFalsy();
    expect(result.steps.find((step) => step.stepId === 'step-4-open-result')?.strategy).toBe('ask-user');
    await executor.close();
  });

});
