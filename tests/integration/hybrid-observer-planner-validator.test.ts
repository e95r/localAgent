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
import { resolveClickableTargetId, resolveClickableTargetIdFromElements } from '../target-resolution.helpers.js';

let baseUrl = '';
let closeServer: (() => Promise<void>) | undefined;

function pickTargetId(ctx: any, predicate: (el: any) => boolean): string {
  const target = ctx.candidateElements.find((el: any) => predicate(el));
  if (target?.id) return target.id;
  const fallback = ctx.candidateElements.find((el: any) => !!el.clickable && !!el.visible && !!el.enabled && typeof el.id === 'string');
  if (!fallback?.id) throw new Error('No valid candidate target for fake LLM');
  return fallback.id;
}

function makeHybrid(llmRaw: (ctx: any) => string, enableLlmFallback = true) {
  const llmPlanner = new LlmPlanner(new FakeLlmClient(llmRaw), [
    'DownloadCapability',
    'OpenRelevantLinkCapability',
    'ExtractMainContentCapability',
    'SelectListItemCapability',
  ]);
  return new HybridPlanner(
    new RuleBasedPlanner(),
    llmPlanner,
    withPlannerConfig({ enableLlmFallback, ruleConfidenceThreshold: 0.95 }),
  );
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
      const targetId = pickTargetId(ctx, (el) => String(el.href ?? '').includes('/primary'));
      return JSON.stringify({
        selectedCapabilityName: 'DownloadCapability',
        action: 'click',
        targetId,
        confidence: 0.9,
        reason: 'primary download link selected',
        candidateTargets: [targetId],
      });
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

  it('ambiguous download with maxSteps=1 navigates to /primary', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/ambiguous-download-choice.html`;
    const targetId = await resolveClickableTargetId(executor, new DOMPageObserver(), pageUrl, (el) => String(el.text ?? '').includes('Primary download'));
    const planner = makeHybrid(() =>
      JSON.stringify({
        selectedCapabilityName: 'DownloadCapability',
        action: 'click',
        targetId,
        confidence: 0.94,
        reason: 'pick primary',
        candidateTargets: [targetId],
      }),
    );

    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    await agent.run('download primary', pageUrl, 1);
    expect(await executor.getCurrentUrl()).toContain('/primary');
    await executor.close();
  });

  it('semantic link choice with maxSteps=1 navigates to /install', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/semantic-link-choice.html`;
    const targetId = await resolveClickableTargetId(executor, new DOMPageObserver(), pageUrl, (el) => String(el.text ?? '').includes('Installation guide'));
    const planner = makeHybrid(() =>
      JSON.stringify({
        selectedCapabilityName: 'OpenRelevantLinkCapability',
        action: 'click',
        targetId,
        confidence: 0.92,
        reason: 'install docs intent',
        candidateTargets: [targetId],
      }),
    );

    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    await agent.run('install docs', pageUrl, 1);
    expect(await executor.getCurrentUrl()).toContain('/install');
    await executor.close();
  });

  it('latest list item with maxSteps=1 navigates to /item-2026-04', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/list-latest-item.html`;
    const targetId = await resolveClickableTargetId(executor, new DOMPageObserver(), pageUrl, (el) => String(el.text ?? '').includes('2026-04 latest'));
    const planner = makeHybrid(() =>
      JSON.stringify({
        selectedCapabilityName: 'SelectListItemCapability',
        action: 'click',
        targetId,
        confidence: 0.91,
        reason: 'latest item',
        candidateTargets: [targetId],
      }),
    );

    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    await agent.run('open latest', pageUrl, 1);
    expect(await executor.getCurrentUrl()).toContain('/item-2026-04');
    await executor.close();
  });

  it('click target resolution does not choose body/container when matching clickable link exists', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/semantic-link-choice.html`;
    await executor.openUrl(pageUrl);
    const state = await new DOMPageObserver().collect(executor.getPage());
    const resolvedId = resolveClickableTargetIdFromElements(state.interactiveElements, (el) => String(el.text ?? '').includes('Installation guide'));
    const resolvedElement = state.interactiveElements.find((el) => el.id === resolvedId);
    expect(resolvedElement?.elementType).toBe('link');
    expect(resolvedElement?.tag).toBe('a');
    await executor.close();
  });

  it('click target resolution for no-id anchor prefers correct exact target and navigates correctly', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/no-id-links.html`;
    const targetId = await resolveClickableTargetId(executor, new DOMPageObserver(), pageUrl, (el) => String(el.text ?? '').includes('Guide middle target'));
    const planner = makeHybrid(() =>
      JSON.stringify({
        selectedCapabilityName: 'OpenRelevantLinkCapability',
        action: 'click',
        targetId,
        confidence: 0.94,
        reason: 'middle link exact match',
        candidateTargets: [targetId],
      }),
    );

    const agent = new BrowserAgent({ executor, observer: new DOMPageObserver(), planner, validator: new DefaultActionValidator() });
    await agent.run('open middle guide', pageUrl, 1);
    expect(await executor.getCurrentUrl()).toContain('/guide-middle');
    await executor.close();
  });

  it('body/container presence in candidates does not break no-id clickable mapping', async () => {
    const executor = new PlaywrightBrowserExecutor();
    const pageUrl = `${baseUrl}/no-id-links.html`;
    await executor.openUrl(pageUrl);
    const state = await new DOMPageObserver().collect(executor.getPage());
    const resolvedId = resolveClickableTargetIdFromElements(state.interactiveElements, (el) => String(el.text ?? '').includes('Guide end target'));
    const resolvedElement = state.interactiveElements.find((el) => el.id === resolvedId);
    expect(resolvedElement?.elementType).toBe('link');
    expect(resolvedElement?.tag).toBe('a');
    expect(resolvedElement?.selectorHint).toContain('data-agent-id');
    await executor.close();
  });
});
