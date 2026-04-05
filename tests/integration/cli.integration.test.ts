import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { executeCliCommand } from '../../src/cli/runtime.js';
import { DEFAULT_RUNTIME_CONFIG } from '../../src/config/runtime-config.js';
import { createFixtureServer } from '../test-server.js';
import { buildSearchAndOpenScenario } from '../../src/library/builders/search-and-open.js';
import { buildDownloadFileScenario } from '../../src/library/builders/download-file.js';
import { ScenarioStore } from '../../src/storage/scenario-store.js';

const config = { ...DEFAULT_RUNTIME_CONFIG };

describe('cli integration', () => {

  it('executeCliCommand does not write JSON output to stdout side effects', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-stdout-clean-'));
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      const scenario = buildSearchAndOpenScenario({ startUrl: `${server.baseUrl}/replay-search-page.html`, query: 'docs', targetKeyword: 'docs' });
      const file = path.join(tmp, 'scenario.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const result = await executeCliCommand({ command: 'replay', file, mode: 'strict', approval: 'never', artifactsDir: tmp, json: true, useLlm: false }, config);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('"scenarioName"');
      expect(stdoutSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });
  it('replay strict runs scenario successfully', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-strict-'));
    try {
      const scenario = buildSearchAndOpenScenario({ startUrl: `${server.baseUrl}/replay-search-page.html`, query: 'docs', targetKeyword: 'docs' });
      const file = path.join(tmp, 'scenario.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const result = await executeCliCommand({ command: 'replay', file, mode: 'strict', approval: 'never', artifactsDir: tmp, json: true, useLlm: false }, config);
      expect(result.exitCode).toBe(0);
      expect(result.summary?.success).toBe(true);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('run-library-scenario works with params', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-lib-'));
    try {
      const result = await executeCliCommand({
        command: 'run-library-scenario',
        scenarioName: 'download-file',
        params: { startUrl: `${server.baseUrl}/replay-download-page.html`, targetKeyword: 'Download' },
        mode: 'adaptive', approval: 'never', artifactsDir: tmp, json: true, useLlm: false,
      }, config);
      expect(result.exitCode).toBe(0);
      const metadata = JSON.parse(await readFile(path.join(tmp, 'library-scenario-metadata.json'), 'utf-8'));
      expect(metadata.name).toBe('download-file');
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('approval risky-only prompts on risky step and reject aborts safely', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-approval-'));
    try {
      const scenario = buildDownloadFileScenario({ startUrl: `${server.baseUrl}/approval-danger.html`, targetKeyword: 'Delete' });
      scenario.steps[1].target = { strictSelectors: ['#danger-delete'], fallbackSelectors: ['button'], text: 'Delete account' };
      const file = path.join(tmp, 'danger.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const result = await executeCliCommand({ command: 'replay', file, mode: 'strict', approval: 'risky-only', artifactsDir: tmp, json: true, useLlm: false }, config, {
        prompter: { prompt: async () => ({ approved: false, answer: 'rejected' }) },
      });
      expect(result.exitCode).toBe(2);
      expect(result.summary?.success).toBe(false);
      const decision = JSON.parse(await readFile(path.join(tmp, 'approval-decision.json'), 'utf-8'));
      expect(decision.response.answer).toBe('rejected');
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('approval always prompts even for safe step', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-approval-always-'));
    let prompted = 0;
    try {
      const scenario = buildSearchAndOpenScenario({ startUrl: `${server.baseUrl}/replay-search-page.html`, query: 'docs', targetKeyword: 'docs' });
      const file = path.join(tmp, 'safe.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const result = await executeCliCommand({ command: 'replay', file, mode: 'strict', approval: 'always', artifactsDir: tmp, json: true, useLlm: false }, config, {
        prompter: { prompt: async () => { prompted += 1; return { approved: true, answer: 'approved' }; } },
      });
      expect(result.exitCode).toBe(0);
      expect(prompted).toBeGreaterThan(0);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('approval never skips prompt', async () => {
    const server = await createFixtureServer();
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cli-approval-never-'));
    let prompted = 0;
    try {
      const scenario = buildSearchAndOpenScenario({ startUrl: `${server.baseUrl}/replay-search-page.html`, query: 'docs', targetKeyword: 'docs' });
      const file = path.join(tmp, 'safe-never.json');
      await new ScenarioStore().saveScenarioToFile(file, scenario);
      const result = await executeCliCommand({ command: 'replay', file, mode: 'strict', approval: 'never', artifactsDir: tmp, json: true, useLlm: false }, config, {
        prompter: { prompt: async () => { prompted += 1; return { approved: true, answer: 'approved' }; } },
      });
      expect(result.exitCode).toBe(0);
      expect(prompted).toBe(0);
    } finally {
      await server.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
