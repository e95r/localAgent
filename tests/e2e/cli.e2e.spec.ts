import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFixtureServer } from '../test-server.js';
import { runCli } from '../../src/cli/index.js';
import { executeCliCommand } from '../../src/cli/runtime.js';
import { DEFAULT_RUNTIME_CONFIG } from '../../src/config/runtime-config.js';
import { ScenarioStore } from '../../src/storage/scenario-store.js';
import { buildSearchAndOpenScenario } from '../../src/library/builders/search-and-open.js';

test.describe('CLI e2e', () => {
  test('replays stable scenario in strict mode', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-e2e-strict-'));
    try {
      const scenario = buildSearchAndOpenScenario({ startUrl: `${server.baseUrl}/replay-search-page.html`, query: 'docs', targetKeyword: 'docs' });
      const file = path.join(tmp, 'scenario.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const code = await runCli(['replay', '--file', file, '--mode', 'strict', '--approval', 'never', '--artifacts-dir', tmp, '--json']);
      expect(code).toBe(0);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('runs library download-file scenario', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-e2e-lib-'));
    try {
      const code = await runCli(['run-library-scenario', 'download-file', '--param', `startUrl=${server.baseUrl}/replay-download-page.html`, '--param', 'targetKeyword=Download', '--mode', 'adaptive', '--approval', 'never', '--artifacts-dir', tmp, '--json']);
      expect(code).toBe(0);
      const summary = JSON.parse(await readFile(path.join(tmp, 'cli-run-summary.json'), 'utf-8'));
      expect(summary.scenarioName).toBe('download-file');
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });



  test('replay with session file succeeds on auth fixture', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-e2e-session-'));
    try {
      const statePath = path.join(tmp, 'state.json');
      await (await import('node:fs/promises')).writeFile(statePath, JSON.stringify({
        cookies: [],
        origins: [{ origin: server.baseUrl, localStorage: [{ name: 'session', value: 'ok' }] }],
      }), 'utf-8');
      const scenario = {
        schemaVersion: '1.0.0', id: 'rw-auth', name: 'rw-auth', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        metadata: { sourceUrl: `${server.baseUrl}/realworld/auth-required-page.html`, startUrl: `${server.baseUrl}/realworld/auth-required-page.html` },
        steps: [{ stepId: 's1', action: { actionType: 'click' }, pageUrlAtRecordTime: `${server.baseUrl}/realworld/auth-required-page.html`, target: { strictSelectors: ['#secret-action'], fallbackSelectors: [] }, postActionExpectation: { textVisible: 'Secret opened' } }],
      };
      const file = path.join(tmp, 'auth.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario as any);
      const code = await runCli(['replay', '--file', file, '--session-file', statePath, '--review', 'verbose', '--approval', 'never', '--artifacts-dir', tmp, '--json']);
      expect(code).toBe(0);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('out-of-origin step asks approval in risky-only mode and reject aborts', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-e2e-risky-'));
    try {
      const scenario = {
        schemaVersion: '1.0.0', id: 'rw-ext', name: 'rw-ext', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        metadata: { sourceUrl: `${server.baseUrl}/realworld/out-of-origin-warning-page.html`, startUrl: `${server.baseUrl}/realworld/out-of-origin-warning-page.html` },
        steps: [{ stepId: 's1', action: { actionType: 'open_url', value: 'https://example.com' }, pageUrlAtRecordTime: `${server.baseUrl}/realworld/out-of-origin-warning-page.html` }],
      };
      const file = path.join(tmp, 'ext.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario as any);
      let prompted = 0;
      const result = await executeCliCommand({
        command: 'replay',
        file,
        mode: 'strict',
        approval: 'risky-only',
        artifactsDir: tmp,
        json: true,
        useLlm: false,
      }, { ...DEFAULT_RUNTIME_CONFIG }, {
        prompter: {
          prompt: async () => {
            prompted += 1;
            return { approved: false, answer: 'rejected', note: 'n' };
          },
        },
      });
      expect(prompted).toBe(1);
      expect(result.exitCode).toBe(2);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });



  test('runs library search-web-and-open-site scenario', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-e2e-search-web-'));
    try {
      const code = await runCli([
        'run-library-scenario',
        'search-web-and-open-site',
        '--param', `searchUrl=${server.baseUrl}/search-engine-ads.html`,
        '--param', 'query=IANA example domains',
        '--param', 'targetKeyword=IANA',
        '--param', 'targetDomain=iana.org',
        '--mode', 'adaptive',
        '--approval', 'never',
        '--artifacts-dir', tmp,
        '--json',
      ]);
      expect(code).toBe(0);
      const summary = JSON.parse(await readFile(path.join(tmp, 'cli-run-summary.json'), 'utf-8'));
      expect(summary.scenarioName).toBe('search-web-and-open-site');
      expect(summary.success).toBe(true);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  test('missing params fail with clean message', async () => {
    const code = await runCli(['run-library-scenario', 'search-and-open', '--param', 'startUrl=http://x', '--json']);
    expect(code).toBeGreaterThan(0);
  });
});
