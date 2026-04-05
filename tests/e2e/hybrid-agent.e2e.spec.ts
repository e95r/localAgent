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
import { resolveClickableTargetId, resolveClickableTargetIdFromElements, resolveTargetId } from '../target-resolution.helpers.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

const observer = new DOMPageObserver();

test.beforeAll(async () => {
  const server = await createFixtureServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.afterAll(async () => closeServer?.());

function makeHybridAgent(
  executor: PlaywrightBrowserExecutor,
  llmRaw: (ctx: any) => string,
  options: { enableLlmFallback?: boolean; ruleConfidenceThreshold?: number; debugArtifacts?: { enabled: boolean; outputDir: string } } = {},
) {
  const config = withPlannerConfig({
    enableLlmFallback: options.enableLlmFallback ?? true,
    ruleConfidenceThreshold: options.ruleConfidenceThreshold ?? 0.65,
  });
  const planner = new HybridPlanner(
    new RuleBasedPlanner(),
    new LlmPlanner(new FakeLlmClient(llmRaw), ['DownloadCapability', 'OpenRelevantLinkCapability', 'ExtractMainContentCapability', 'SelectListItemCapability']),
    config,
  );
  return new BrowserAgent({ executor, observer, planner, validator: new DefaultActionValidator(), debugArtifacts: options.debugArtifacts });
}

test('rule-based planner solves simple download without llm', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => { throw new Error('no llm'); }, { enableLlmFallback: false });
  const steps = await agent.run('download pdf', `${baseUrl}/download.html`, 1);
  expect(steps[0].action.plannerSource).toBe('rule-based');
  await executor.close();
});

test('ambiguous download is resolved by llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/ambiguous-download-choice.html`;
  const resolvedTargetId = await resolveClickableTargetId(executor, observer, pageUrl, (el) => String(el.text ?? '').includes('Primary download'));
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'DownloadCapability', action: 'click', targetId: resolvedTargetId, confidence: 0.92, reason: 'primary', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  await agent.run('download main file', pageUrl, 1);
  expect(await executor.getCurrentUrl()).toContain('/primary');
  await executor.close();
});

test('semantic relevant link is chosen by llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/semantic-link-choice.html`;
  const resolvedTargetId = await resolveClickableTargetId(executor, observer, pageUrl, (el) => String(el.text ?? '').includes('Installation guide'));
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'OpenRelevantLinkCapability', action: 'click', targetId: resolvedTargetId, confidence: 0.88, reason: 'install intent', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  await agent.run('open install docs', pageUrl, 1);
  expect(await executor.getCurrentUrl()).toContain('/install');
  await executor.close();
});

test('main content is selected via llm fallback', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/multi-content-page.html`;
  const resolvedTargetId = await resolveTargetId(executor, observer, pageUrl, (el) => el.tag === 'main');
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'ExtractMainContentCapability', action: 'extract_text', targetId: resolvedTargetId, confidence: 0.9, reason: 'main tag', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  const steps = await agent.run('extract main content', pageUrl, 1);
  expect(steps.some((step) => (step.extractedText ?? '').includes('primary text content'))).toBeTruthy();
  await executor.close();
});

test('latest list item is selected via hybrid planning', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/list-latest-item.html`;
  const resolvedTargetId = await resolveClickableTargetId(executor, observer, pageUrl, (el) => String(el.text ?? '').includes('2026-04 latest'));
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'SelectListItemCapability', action: 'click', targetId: resolvedTargetId, confidence: 0.85, reason: 'latest', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  await agent.run('open latest item', pageUrl, 1);
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
  const agent = makeHybridAgent(executor, () => '{bad-json', { debugArtifacts: { enabled: true, outputDir: dir } });
  const steps = await agent.run('download', `${baseUrl}/ambiguous-download-choice.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  const folders = await readdir(dir);
  expect(folders.length).toBeGreaterThan(0);
  await executor.close();
  await rm(dir, { recursive: true, force: true });
});

test('when llm disabled deterministic path still works', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const agent = makeHybridAgent(executor, () => { throw new Error('must not call'); }, { enableLlmFallback: false });
  const steps = await agent.run('search docs', `${baseUrl}/ambiguous-search-page.html`, 2);
  expect(steps.at(-1)?.action.type).toBe('ask_user');
  expect(steps.at(-1)?.action.plannerSource).toBe('rule-based');
  await executor.close();
});

test('clickable target resolution prefers link over body with same text presence', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/ambiguous-download-choice.html`;
  await executor.openUrl(pageUrl);
  const state = await observer.collect(executor.getPage());
  const resolvedTargetId = resolveClickableTargetIdFromElements(state.interactiveElements, (el) => String(el.text ?? '').includes('Primary download'));
  const resolvedTarget = state.interactiveElements.find((el) => el.id === resolvedTargetId);
  expect(resolvedTarget?.elementType).toBe('link');
  expect(resolvedTarget?.tag).toBe('a');
  await executor.close();
});

test('no-id middle link click navigates to correct href', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/no-id-links.html`;
  const resolvedTargetId = await resolveClickableTargetId(executor, observer, pageUrl, (el) => String(el.text ?? '').includes('Guide middle target'));
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'OpenRelevantLinkCapability', action: 'click', targetId: resolvedTargetId, confidence: 0.91, reason: 'middle target', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  await agent.run('open middle guide', pageUrl, 1);
  expect(await executor.getCurrentUrl()).toContain('/guide-middle');
  await executor.close();
});

test('no-id last link click navigates correctly without timeout', async () => {
  const executor = new PlaywrightBrowserExecutor();
  const pageUrl = `${baseUrl}/no-id-links.html`;
  const resolvedTargetId = await resolveClickableTargetId(executor, observer, pageUrl, (el) => String(el.text ?? '').includes('Guide end target'));
  const agent = makeHybridAgent(executor, () => {
    return JSON.stringify({ selectedCapabilityName: 'OpenRelevantLinkCapability', action: 'click', targetId: resolvedTargetId, confidence: 0.9, reason: 'end target', candidateTargets: [resolvedTargetId] });
  }, { ruleConfidenceThreshold: 1.1 });
  await agent.run('open last guide', pageUrl, 1);
  expect(await executor.getCurrentUrl()).toContain('/guide-end');
  await executor.close();
});
