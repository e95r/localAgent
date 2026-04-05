import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { ScenarioRunner } from '../../src/replay/scenario-runner.js';
import type { Scenario } from '../../src/scenario/types.js';
import { createFixtureServer } from '../test-server.js';
import { executeCliCommand } from '../../src/cli/runtime.js';
import { DEFAULT_RUNTIME_CONFIG } from '../../src/config/runtime-config.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});
afterAll(async () => closeServer?.());

function scenarioFor(url: string, selector: string, expectation: { textVisible?: string; urlIncludes?: string } = {}): Scenario {
  return {
    schemaVersion: '1.0.0',
    id: 'rw',
    name: 'rw',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { sourceUrl: url, startUrl: url },
    steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: url, target: { strictSelectors: [selector], fallbackSelectors: [], text: 'target' }, postActionExpectation: expectation }],
  };
}

describe('realworld hardening integration', () => {
  it('handles cookie banner before main click', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenarioFor(`${baseUrl}/realworld/cookie-banner-page.html`, '#main-action', { textVisible: 'Main done' }), { mode: 'adaptive', autoConsent: true, maxRetriesPerStep: 1 });
    expect(result.success).toBe(true);
    await executor.close();
  });

  it('closes newsletter modal before main click', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenarioFor(`${baseUrl}/realworld/modal-newsletter-page.html`, '#main-action', { textVisible: 'Main done' }), { mode: 'adaptive', autoConsent: true });
    expect(result.success).toBe(true);
    await executor.close();
  });

  it('waits for delayed enabled button', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    const result = await runner.runScenario(scenarioFor(`${baseUrl}/realworld/disabled-then-enabled-page.html`, '#late-btn', { textVisible: 'clicked' }), { mode: 'adaptive', waitStrategy: 'stable', maxRetriesPerStep: 2 });
    expect(result.success).toBe(true);
    await executor.close();
  });

  it('site profile helps dashboard target resolution', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    const scenario = scenarioFor(`${baseUrl}/realworld/dashboard-like-page.html`, '#missing-selector', { textVisible: 'dashboard target done' });
    const result = await runner.runScenario(scenario, {
      mode: 'adaptive',
      siteProfile: {
        name: 'fixture-dashboard', domainPattern: /.*/, consentSelectors: [], modalCloseSelectors: [], spinnerSelectors: [], riskyKeywords: [],
        preferredSelectors: ['[data-panel="primary"] button[data-role="target"]'],
      },
    });
    expect(result.success).toBe(true);
    await executor.close();
  });

  it('writes retry/debug artifacts on failure', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'rw-artifacts-'));
    const executor = new PlaywrightBrowserExecutor();
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    try {
      const bad = scenarioFor(`${baseUrl}/realworld/dashboard-like-page.html`, '#nope', { textVisible: 'never' });
      const result = await runner.runScenario(bad, { mode: 'strict', debugArtifacts: { enabled: true, outputDir: tmp }, maxRetriesPerStep: 0 });
      expect(result.success).toBe(false);
      const dirs = (await (await import('node:fs/promises')).readdir(tmp)).filter((d) => d.includes('replay-failure'));
      const dir = path.join(tmp, dirs[0]);
      const retryTrace = JSON.parse(await readFile(path.join(dir, 'retry-trace.json'), 'utf-8'));
      expect(Array.isArray(retryTrace)).toBe(true);
    } finally {
      await executor.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('session file for auth-required page succeeds via CLI', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'rw-session-'));
    try {
      const statePath = path.join(tmp, 'state.json');
      await writeFile(statePath, JSON.stringify({
        cookies: [],
        origins: [{ origin: baseUrl, localStorage: [{ name: 'session', value: 'ok' }] }],
      }), 'utf-8');
      await writeFile(path.join(tmp, 'scenario.json'), JSON.stringify(scenarioFor(`${baseUrl}/realworld/auth-required-page.html`, '#secret-action', { textVisible: 'Secret opened' }), null, 2));
      const result = await executeCliCommand({ command: 'replay', file: path.join(tmp, 'scenario.json'), mode: 'adaptive', approval: 'never', artifactsDir: tmp, json: true, useLlm: false, sessionFile: statePath, siteProfile: 'generic', review: 'verbose', maxRetries: 1, waitStrategy: 'auto', autoConsent: true }, DEFAULT_RUNTIME_CONFIG);
      expect(result.exitCode).toBe(0);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('expired session metadata leads to clean failure on auth page', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'rw-expired-'));
    try {
      const statePath = path.join(tmp, 'state.json');
      await writeFile(statePath, JSON.stringify({ cookies: [], origins: [] }), 'utf-8');
      await writeFile(`${statePath}.meta.json`, JSON.stringify({ expired: true }), 'utf-8');
      await writeFile(path.join(tmp, 'scenario.json'), JSON.stringify(scenarioFor(`${baseUrl}/realworld/auth-required-page.html`, '#secret-action', { textVisible: 'Secret opened' }), null, 2));
      const result = await executeCliCommand({ command: 'replay', file: path.join(tmp, 'scenario.json'), mode: 'strict', approval: 'never', artifactsDir: tmp, json: true, useLlm: false, sessionFile: statePath, siteProfile: 'generic', review: 'compact', maxRetries: 0, waitStrategy: 'fast', autoConsent: true }, DEFAULT_RUNTIME_CONFIG);
      expect(result.exitCode).toBe(2);
      const meta = JSON.parse(await readFile(path.join(tmp, 'session-state-meta.json'), 'utf-8'));
      expect(meta.status).toBe('expired');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
