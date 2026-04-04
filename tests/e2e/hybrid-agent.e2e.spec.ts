import { test, expect } from '@playwright/test';
import { createFixtureServer } from '../test-server.js';
import { PlaywrightBrowserExecutor } from '../../src/executor/browser-executor.js';
import { DOMPageObserver } from '../../src/observer/page-observer.js';
import { RuleBasedPlanner } from '../../src/planner/rule-based-planner.js';
import { DefaultActionValidator } from '../../src/validator/action-validator.js';
import { BrowserAgent } from '../../src/agent/agent.js';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';
import { LlmPlanner } from '../../src/planner/llm-planner.js';
import { HybridPlanner } from '../../src/planner/hybrid-planner.js';
import { withPlannerConfig } from '../../src/planner/planner-config.js';
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

function pickTargetId(ctx: any, predicate: (el: any) => boolean): string {
  const target = ctx.candidateElements.find((el: any) => predicate(el));
  if (target?.id) return target.id;
  const fallback = ctx.candidateElements.find((el: any) => !!el.clickable && !!el.visible && !!el.enabled && typeof el.id === 'string');
  if (!fallback?.id) throw new Error('No valid candidate target for fake LLM');
  return fallback.id;
}

function makeHybridAgent(executor: PlaywrightBrowserExecutor, llmRaw: (ctx: any) => string, enableLlmFallback = true, debugArtifacts?: { enabled: boolean; outputDir: string }) {
  const planner = new HybridPlanner(
    new RuleBasedPlanner(),
    new LlmPlanner(new FakeLlmClient(llmRaw), ['DownloadCapability', 'OpenRelevantLinkCapability', 'ExtractMainContentCapability', 'SelectListItemCapability']),
    withPlannerConfig({ enableLlmFallback, ruleConfidenceThreshold: 0.95 }),
  );
  return new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator(), debugArtifacts });
}

test('rule-based planner solves simple download without llm', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => { throw new Error('no llm'); });
  const steps = await agent.run('download pdf', `${baseUrl}/download.html`, 2);
  expect(steps[0].action.plannerSource).toBe('rule-based');
  await executor.close();
});

test('ambiguous download is resolved by llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, (ctx) => {
    const targetId = pickTargetId(ctx, (el) => String(el.href ?? '').includes('/primary'));
    return JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId, confidence: 0.92, reason: 'primary', candidateTargets: [targetId] });
  });
  await agent.run('download main file', `${baseUrl}/ambiguous-download-choice.html`, 2);
  expect(await executor.getCurrentUrl()).toContain('/primary');
  await executor.close();
});

test('semantic relevant link is chosen by llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, (ctx) => {
    const targetId = pickTargetId(ctx, (el) => String(el.href ?? '').includes('/install'));
    return JSON.stringify({ selectedCapabilityName: 'OpenRelevantLinkCapability', action: 'click', targetId, confidence: 0.88, reason: 'install intent', candidateTargets: [targetId] });
  });
  await agent.run('open install docs', `${baseUrl}/semantic-link-choice.html`, 2);
  expect(await executor.getCurrentUrl()).toContain('/install');
  await executor.close();
});

test('main content is selected via llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, (ctx) => {
    const targetId = pickTargetId(ctx, (el) => el.tag === 'main');
    return JSON.stringify({ selectedCapabilityName: 'ExtractMainContentCapability', action: 'extract_text', targetId, confidence: 0.9, reason: 'main tag', candidateTargets: [targetId] });
  });
  const steps = await agent.run('extract main content', `${baseUrl}/multi-content-page.html`, 2);
  expect(steps.some((step) => (step.extractedText ?? '').includes('primary text content'))).toBeTruthy();
  await executor.close();
});

test('latest list item is selected via hybrid planning', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, (ctx) => {
    const targetId = pickTargetId(ctx, (el) => String(el.href ?? '').includes('/item-2026-04'));
    return JSON.stringify({ selectedCapabilityName: 'SelectListItemCapability', action: 'click', targetId, confidence: 0.85, reason: 'latest', candidateTargets: [targetId] });
  });
  await agent.run('open latest item', `${baseUrl}/list-latest-item.html`, 2);
  expect(await executor.getCurrentUrl()).toContain('/item-2026-04');
  await executor.close();
});

test('invalid llm target is rejected by validator', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: 'el-missing', confidence: 0.9, reason: 'wrong', candidateTargets: ['el-missing'] }));
  const steps = await agent.run('do action', `${baseUrl}/invalid-llm-target-page.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  await executor.close();
});

test('invalid llm JSON response leads to ask_user and artifacts', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'hybrid-e2e-artifacts-'));
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => '{bad-json', true, { enabled: true, outputDir: dir });
  const steps = await agent.run('download', `${baseUrl}/ambiguous-download-choice.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  const folders = await readdir(dir);
  expect(folders.length).toBeGreaterThan(0);
  await executor.close();
  await rm(dir, { recursive: true, force: true });
});

test('when llm disabled deterministic path still works', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => { throw new Error('must not call'); }, false);
  const steps = await agent.run('search docs', `${baseUrl}/ambiguous-search-page.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  expect(steps.at(-1)?.action.plannerSource).toBe('rule-based');
  await executor.close();
});
