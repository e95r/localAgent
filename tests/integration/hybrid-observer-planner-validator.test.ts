import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BrowserAgent } from '../../src/agent/agent.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { HybridPlanner } from '../../src/planner/hybrid-planner.js';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { withPlannerConfig } from '../../src/planner/planner-config.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { createFixtureServer } from '../test-server.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

function makeHybrid(llmRaw: (ctx: any) => string, enableLlmFallback = true) {
  const llmPlanner = new LlmPlanner(new FakeLlmClient(llmRaw), [
    'DownloadCapability',
    'OpenRelevantLinkCapability',
    'ExtractMainContentCapability',
    'SelectListItemCapability',
  ]);
  return new HybridPlanner(new RuleBasedPlanner(), llmPlanner, withPlannerConfig({ enableLlmFallback }));
}

describe('hybrid planner integration', () => {
  beforeAll(async () => {
    const server = await createFixtureServer();
    baseUrl = server.baseUrl;
    closeServer = server.close;
  });
  afterAll(async () => closeServer?.());

  it('rule-based low confidence triggers llm and executes valid action', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const planner = makeHybrid((ctx) => {
      const primary = ctx.candidateElements.find((el: any) => String(el.text).includes('Primary'));
      return JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: primary?.id, confidence: 0.9, reason: 'primary', candidateTargets: [primary?.id] });
    });
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    const steps = await agent.run('download the main file', `${baseUrl}/ambiguous-download-choice.html`, 2);
    expect(steps[0].action.plannerSource).toBe('llm');
    expect(await executor.getCurrentUrl()).toContain('/primary');
    await executor.close();
  });

  it('invalid llm target id is rejected by validator and converted to ask_user', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const planner = makeHybrid(() => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: 'el-404', confidence: 0.9, reason: 'wrong', candidateTargets: ['el-404'] }));
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    const steps = await agent.run('download', `${baseUrl}/invalid-llm-target-page.html`, 2);
    expect(steps.at(-1)?.action.type).toBe('ask_user');
    await executor.close();
  });

  it('invalid llm JSON falls back to ask_user and artifacts are saved', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'hybrid-artifacts-'));
    const executor = new PlaywrightBrowserExecutor();
    const planner = makeHybrid(() => '{oops');
    const agent = new BrowserAgent({
      executor,
      observer: new DOMPageObserver(),
      planner,
      validator: new DefaultActionValidator(),
      debugArtifacts: { enabled: true, outputDir: dir },
    });
    const steps = await agent.run('download', `${baseUrl}/ambiguous-download-choice.html`, 2);
    expect(steps.at(-1)?.action.type).toBe('ask_user');
    const folders = await readdir(dir);
    expect(folders.length).toBeGreaterThan(0);
    await executor.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('llm disabled keeps deterministic behavior', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const planner = makeHybrid(() => {
      throw new Error('should not be called');
    }, false);
    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    const steps = await agent.run('download', `${baseUrl}/ambiguous-download-choice.html`, 2);
    expect(steps.at(-1)?.action.type).toBe('ask_user');
    expect(steps.at(-1)?.action.plannerSource).toBe('rule-based');
    await executor.close();
  });
});
