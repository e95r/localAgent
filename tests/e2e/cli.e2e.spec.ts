import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFixtureServer } from '../test-server.js';
import { runCli } from '../../src/cli/index.js';
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

  test('missing params fail with clean message', async () => {
    const code = await runCli(['run-library-scenario', 'search-and-open', '--param', 'startUrl=http://x', '--json']);
    expect(code).toBeGreaterThan(0);
  });
});
