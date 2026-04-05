import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { BrowserExecutor } from '../executor/browser-executor.js';
import type { PageObserver } from '../observer/page-observer.js';
import type { ActionValidator } from '../validator/action-validator.js';
import type { AgentAction } from '../types/actions.js';
import type { ReplayMode, ReplayResult, ReplayStepResult, Scenario } from '../scenario/types.js';
import type { RecordedTargetSnapshot } from '../scenario/types.js';
import { ReplayTargetResolver } from './target-resolver.js';
import { verifyPostStepExpectation } from './post-step-verifier.js';
import type { WaitStrategy } from '../readiness/wait-strategy.js';
import { PageReadinessEvaluator } from '../readiness/page-readiness-evaluator.js';
import type { SiteProfile } from '../profiles/site-profile.js';
import { GENERIC_PROFILE } from '../profiles/site-profile.js';
import { ConsentBannerResolver } from '../banner/consent-resolver.js';
import { ReplayRecoveryPolicy } from '../recovery/retry-policy.js';
import { StateTransitionTracker } from '../readiness/state-transition-tracker.js';
import type { InteractiveElement, PageState } from '../types/page-state.js';

export interface ScenarioRunnerOptions {
  mode: ReplayMode;
  maxRetriesPerStep?: number;
  debugArtifacts?: { enabled: boolean; outputDir: string };
  plannerAssistedResolver?: (ctx: { scenario: Scenario; stepIndex: number; pageUrl: string }) => Promise<string | null>;
  approvalHandler?: (ctx: { scenario: Scenario; stepIndex: number; confidence: number; strategy: string; action: AgentAction; reason: string }) => Promise<{ approved: boolean; outcome: 'not-required' | 'approved' | 'rejected'; prompt?: string; decision?: unknown }>;
  onStepComplete?: (summary: { stepId: string; actionType: string; target: string; result: 'success' | 'failure'; durationMs: number; plannerSource: string; approvalOutcome: 'not-required' | 'approved' | 'rejected' }) => void;
  waitStrategy?: WaitStrategy;
  autoConsent?: boolean;
  siteProfile?: SiteProfile;
}

export class ScenarioRunner {
  private readonly resolver = new ReplayTargetResolver();
  private readonly readiness = new PageReadinessEvaluator();
  private readonly consentResolver = new ConsentBannerResolver();

  constructor(private readonly deps: { executor: BrowserExecutor; observer: PageObserver; validator: ActionValidator }) {}

  async runScenario(scenario: Scenario, options: ScenarioRunnerOptions): Promise<ReplayResult> {
    const results: ReplayStepResult[] = [];
    const tracker = new StateTransitionTracker();
    const maxRetries = options.maxRetriesPerStep ?? 1;
    const retryPolicy = new ReplayRecoveryPolicy(maxRetries + 1);
    const profile = options.siteProfile ?? GENERIC_PROFILE;
    const waitStrategy = options.waitStrategy ?? 'auto';

    await this.deps.executor.openUrl(scenario.metadata.startUrl);
    tracker.log('start', { startUrl: scenario.metadata.startUrl, profile: profile.name });

    for (let index = 0; index < scenario.steps.length; index += 1) {
      const step = scenario.steps[index];
      let attempts = 0;
      let done = false;

      while (!done && attempts <= maxRetries) {
        attempts += 1;
        const started = Date.now();
        try {
          const state = await this.deps.observer.collect(this.deps.executor.getPage());
          const beforeUrl = state.url;

          const readiness = await this.readiness.waitUntilReady(this.deps.executor.getPage(), profile, waitStrategy);
          tracker.log('readiness', { stepId: step.stepId, ...readiness });
          if (!readiness.ready) {
            const retry = retryPolicy.decide(attempts, 'readiness-timeout');
            tracker.log('retry', { ...retry });
            if (retry.shouldRetry) continue;
          }

          const banner = await this.consentResolver.handleIfSafe(this.deps.executor.getPage(), profile, options.autoConsent ?? true);
          tracker.log('banner', { stepId: step.stepId, ...banner });
          if (banner.detected && banner.ambiguous && options.approvalHandler) {
            const approval = await options.approvalHandler({
              scenario,
              stepIndex: index,
              confidence: 0.55,
              strategy: 'ask-user',
              action: { type: 'ask_user', question: 'Approve ambiguous banner action?', plannerSource: 'rule-based' },
              reason: banner.reason,
            });
            if (!approval.approved) {
              const rejected: ReplayStepResult = {
                stepId: step.stepId,
                actionType: step.action.actionType,
                success: false,
                strategy: 'ask-user',
                confidence: 0.55,
                reason: 'Ambiguous banner/modal action rejected',
                askUserQuestion: 'Ambiguous banner action requires confirmation',
                approvalOutcome: approval.outcome,
              };
              results.push(rejected);
              await this.persistArtifacts(options, scenario, results, rejected, { tracker: tracker.snapshot(), profile, banner });
              return this.finish(options.mode, results);
            }
          }

          if (step.action.actionType === 'open_url') {
            let approvalOutcome: 'not-required' | 'approved' | 'rejected' = 'not-required';
            let approvalPrompt: string | undefined;
            let approvalDecision: unknown;
            if (options.approvalHandler) {
              const approval = await options.approvalHandler({
                scenario,
                stepIndex: index,
                confidence: 1,
                strategy: 'strict-selector',
                action: { type: 'ask_user', question: `open_url:${step.action.value ?? scenario.metadata.startUrl}`, plannerSource: 'rule-based' },
                reason: 'URL opened',
              });
              approvalOutcome = approval.outcome;
              approvalPrompt = approval.prompt;
              approvalDecision = approval.decision;
              if (!approval.approved) {
                const rejected: ReplayStepResult = {
                  stepId: step.stepId,
                  actionType: step.action.actionType,
                  success: false,
                  strategy: 'ask-user',
                  confidence: 1,
                  reason: 'Action rejected by approval policy',
                  askUserQuestion: 'User rejected risky action',
                  approvalOutcome,
                };
                results.push(rejected);
                options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.action.value ?? '', result: 'failure', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome });
                await this.persistArtifacts(options, scenario, results, rejected, { approvalPrompt, approvalDecision, tracker: tracker.snapshot(), profile, banner });
                return this.finish(options.mode, results);
              }
            }
            await this.deps.executor.openUrl(step.action.value ?? scenario.metadata.startUrl);
            const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation);
            const result: ReplayStepResult = { stepId: step.stepId, actionType: step.action.actionType, success: expectedCheck.passed, strategy: 'strict-selector', confidence: 1, reason: 'URL opened', expectedCheck, approvalOutcome };
            results.push(result);
            options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.action.value ?? '', result: result.success ? 'success' : 'failure', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome });
            done = true;
            continue;
          }

          if (step.action.actionType === 'wait_for') {
            if (step.action.value) await this.deps.executor.waitForElement(step.action.value);
            const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation);
            const result: ReplayStepResult = { stepId: step.stepId, actionType: step.action.actionType, success: expectedCheck.passed, strategy: 'strict-selector', confidence: 1, reason: 'Wait complete', expectedCheck, approvalOutcome: 'not-required' };
            results.push(result);
            options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.action.value ?? '', result: result.success ? 'success' : 'failure', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome: 'not-required' });
            done = true;
            continue;
          }

          if (step.action.actionType === 'finish') {
            const result: ReplayStepResult = { stepId: step.stepId, actionType: step.action.actionType, success: true, strategy: 'strict-selector', confidence: 1, reason: step.action.value ?? 'Finished', approvalOutcome: 'not-required' };
            results.push(result);
            options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.action.value ?? '', result: 'success', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome: 'not-required' });
            done = true;
            continue;
          }

          if (!step.target) throw new Error('Step target is missing');
          let resolution = await this.resolver.resolve(this.deps.executor.getPage(), step.target, options.mode);

          if (!resolution.locator && profile.preferredSelectors.length > 0) {
            for (const selector of profile.preferredSelectors) {
              const loc = this.deps.executor.getPage().locator(selector).first();
              if (await loc.count()) {
                resolution = { locator: loc, confidence: 0.75, reason: 'Resolved by site profile preferred selector', strategy: 'planner-assisted' };
                break;
              }
            }
          }

          if (!resolution.locator && options.mode === 'adaptive' && options.plannerAssistedResolver) {
            const plannerSelector = await options.plannerAssistedResolver({ scenario, stepIndex: index, pageUrl: await this.deps.executor.getCurrentUrl() });
            if (plannerSelector) {
              const plannerLocator = this.deps.executor.getPage().locator(plannerSelector).first();
              if (await plannerLocator.count()) {
                resolution = { locator: plannerLocator, confidence: 0.7, reason: 'Resolved by planner-assisted fallback', strategy: 'planner-assisted' };
              }
            }
          }

          if (!resolution.locator || resolution.confidence < 0.5) {
            const askResult: ReplayStepResult = {
              stepId: step.stepId,
              actionType: step.action.actionType,
              success: false,
              strategy: 'ask-user',
              confidence: resolution.confidence,
              reason: resolution.reason,
              askUserQuestion: 'Не удалось надёжно сопоставить элемент. Нужна помощь пользователя.',
              approvalOutcome: 'not-required',
            };
            results.push(askResult);
            await this.persistArtifacts(options, scenario, results, askResult, { resolution, tracker: tracker.snapshot(), profile, banner });
            return this.finish(options.mode, results);
          }

          const strictSelector = step.target.strictSelectors[0];
          if (strictSelector && (step.action.actionType === 'click' || step.action.actionType === 'submit_search')) {
            await this.readiness.waitForEnabled(this.deps.executor.getPage(), strictSelector, waitStrategy);
          }

          const targetId = await resolution.locator.evaluate((el) => el.getAttribute('data-agent-id') ?? '');
          const validationState = targetId.trim() ? state : await this.deps.observer.collect(this.deps.executor.getPage());
          const resolvedElementMetadata = targetId.trim()
            ? null
            : await resolution.locator.evaluate((el) => {
              const element = el as HTMLElement;
              const anchor = el as HTMLAnchorElement;
              return {
                tag: element.tagName.toLowerCase(),
                text: (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim(),
                href: anchor.getAttribute('href') ?? anchor.href ?? '',
                ariaLabel: element.getAttribute('aria-label') ?? '',
                placeholder: (el as HTMLInputElement).placeholder ?? '',
              };
            });
          const validatedTargetId = targetId.trim() || this.resolveTargetIdFromState(step.target, validationState, resolvedElementMetadata);
          const mappedAction = this.toAgentAction(step.action.actionType, validatedTargetId, step.action.value, step.action.mode);
          if (validatedTargetId) {
            this.deps.validator.validate(mappedAction, validationState);
          } else {
            tracker.log('validation-skip', { stepId: step.stepId, reason: 'resolved-locator-without-agent-id' });
          }

          let approvalOutcome: 'not-required' | 'approved' | 'rejected' = 'not-required';
          let approvalPrompt: string | undefined;
          let approvalDecision: unknown;
          if (options.approvalHandler) {
            const approval = await options.approvalHandler({
              scenario,
              stepIndex: index,
              confidence: resolution.confidence,
              strategy: resolution.strategy,
              action: mappedAction,
              reason: resolution.reason,
            });
            approvalOutcome = approval.outcome;
            approvalPrompt = approval.prompt;
            approvalDecision = approval.decision;
            if (!approval.approved) {
              const rejected: ReplayStepResult = {
                stepId: step.stepId,
                actionType: step.action.actionType,
                success: false,
                strategy: 'ask-user',
                confidence: resolution.confidence,
                reason: 'Action rejected by approval policy',
                askUserQuestion: 'User rejected risky action',
                approvalOutcome,
              };
              results.push(rejected);
              options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.target.text ?? step.target.strictSelectors[0] ?? '', result: 'failure', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome });
              await this.persistArtifacts(options, scenario, results, rejected, { resolution, approvalPrompt, approvalDecision, tracker: tracker.snapshot(), profile, banner });
              return this.finish(options.mode, results);
            }
          }

          let extractedText = '';
          let downloadsCount = 0;
          if (step.action.actionType === 'click') {
            await resolution.locator.click();
            await this.deps.executor.waitForPageSettled(beforeUrl);
          } else if (step.action.actionType === 'type') {
            await resolution.locator.fill(step.action.value ?? '');
          } else if (step.action.actionType === 'submit_search') {
            if (step.action.mode === 'enter') await resolution.locator.press('Enter');
            else await resolution.locator.click();
            await this.deps.executor.waitForPageSettled(beforeUrl);
          } else if (step.action.actionType === 'extract_text') {
            extractedText = await resolution.locator.textContent() ?? '';
          }

          if (step.postActionExpectation?.fileDownloadExpected && step.action.actionType === 'click') {
            downloadsCount = 1;
          }

          const expectedCheck = await verifyPostStepExpectation(this.deps.executor, step.postActionExpectation, extractedText, downloadsCount);
          const stepResult: ReplayStepResult = {
            stepId: step.stepId,
            actionType: step.action.actionType,
            success: expectedCheck.passed,
            strategy: resolution.strategy,
            confidence: resolution.confidence,
            reason: resolution.reason,
            extractedText,
            expectedCheck,
            approvalOutcome,
            plannerSource: 'replay',
          };

          if (!expectedCheck.passed && options.mode === 'adaptive') {
            const retry = retryPolicy.decide(attempts, 'expectation-failed');
            tracker.log('retry', { ...retry });
            if (retry.shouldRetry) continue;
          }

          results.push(stepResult);
          tracker.log('action', { stepId: step.stepId, success: stepResult.success, strategy: stepResult.strategy });
          options.onStepComplete?.({ stepId: step.stepId, actionType: step.action.actionType, target: step.target.text ?? step.target.strictSelectors[0] ?? '', result: stepResult.success ? 'success' : 'failure', durationMs: Date.now() - started, plannerSource: 'replay', approvalOutcome });
          if (!expectedCheck.passed) {
            await this.persistArtifacts(options, scenario, results, stepResult, { resolution, tracker: tracker.snapshot(), profile, banner });
            return this.finish(options.mode, results);
          }
          done = true;
        } catch (error) {
          const retry = retryPolicy.decide(attempts, 'execution-error');
          tracker.log('retry', { ...retry, error: error instanceof Error ? error.message : String(error) });
          if (!retry.shouldRetry) {
            const failed: ReplayStepResult = {
              stepId: step.stepId,
              actionType: step.action.actionType,
              success: false,
              strategy: 'ask-user',
              confidence: 0,
              reason: 'Replay execution failed',
              error: error instanceof Error ? error.message : String(error),
              approvalOutcome: 'not-required',
            };
            results.push(failed);
            await this.persistArtifacts(options, scenario, results, failed, { tracker: tracker.snapshot(), profile });
            return this.finish(options.mode, results);
          }
        }
      }
    }

    return this.finish(options.mode, results);
  }

  private toAgentAction(type: ReplayStepResult['actionType'], targetId: string, value?: string, mode?: 'button' | 'enter'): AgentAction {
    if (type === 'click') return { type: 'click', targetId, plannerSource: 'rule-based' };
    if (type === 'type') return { type: 'type', targetId, text: value ?? '', plannerSource: 'rule-based' };
    if (type === 'extract_text') return { type: 'extract_text', targetId, plannerSource: 'rule-based' };
    if (type === 'submit_search') return { type: 'submit_search', targetId, mode: mode ?? 'enter', plannerSource: 'rule-based' };
    return { type: 'ask_user', question: 'unsupported', plannerSource: 'hybrid-ask-user' };
  }

  private resolveTargetIdFromState(
    target: RecordedTargetSnapshot,
    state: PageState,
    resolvedElement?: { tag: string; text: string; href: string; ariaLabel: string; placeholder: string } | null,
  ): string {
    const preferredSelectors = new Set([...target.strictSelectors, ...target.fallbackSelectors].filter(Boolean));
    const keyword = (target.targetKeyword ?? target.text ?? '').toLowerCase().trim();
    const domain = (target.targetDomain ?? target.href ?? '').toLowerCase().trim();

    const scored = state.interactiveElements
      .map((element) => ({ element, score: this.scoreValidationCandidate(element, preferredSelectors, keyword, domain, resolvedElement) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return '';
    if (scored[1] && scored[0].score === scored[1].score) return '';
    return scored[0].element.id;
  }

  private scoreValidationCandidate(
    element: InteractiveElement,
    preferredSelectors: Set<string>,
    keyword: string,
    domain: string,
    resolvedElement?: { tag: string; text: string; href: string; ariaLabel: string; placeholder: string } | null,
  ): number {
    let score = 0;
    if (preferredSelectors.has(element.selectorHint)) score += 6;
    if (keyword && element.text.toLowerCase().includes(keyword)) score += 4;
    if (domain && (element.href ?? '').toLowerCase().includes(domain)) score += 5;
    if (resolvedElement) {
      if (resolvedElement.tag && element.tag === resolvedElement.tag) score += 2;
      if (resolvedElement.text && element.text === resolvedElement.text) score += 3;
      if (resolvedElement.href && (element.href ?? '') === resolvedElement.href) score += 4;
      if (resolvedElement.ariaLabel && (element.ariaLabel ?? '') === resolvedElement.ariaLabel) score += 1;
      if (resolvedElement.placeholder && (element.placeholder ?? '') === resolvedElement.placeholder) score += 1;
    }
    return score;
  }

  private finish(mode: ReplayMode, steps: ReplayStepResult[]): ReplayResult {
    return {
      mode,
      success: steps.every((step) => step.success),
      finishedAt: new Date().toISOString(),
      steps,
    };
  }

  private async persistArtifacts(
    options: ScenarioRunnerOptions,
    scenario: Scenario,
    stepResults: ReplayStepResult[],
    failure: ReplayStepResult,
    resolution?: unknown,
  ): Promise<void> {
    if (!options.debugArtifacts?.enabled) return;
    const dir = path.join(options.debugArtifacts.outputDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-replay-failure`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'scenario.json'), JSON.stringify(scenario, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-mode.json'), JSON.stringify({ mode: options.mode }, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-step-results.json'), JSON.stringify(stepResults, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'target-resolution.json'), JSON.stringify(resolution ?? {}, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'replay-failure-reason.txt'), `${failure.reason}${failure.error ? `\n${failure.error}` : ''}`, 'utf-8');
    await writeFile(path.join(dir, 'expected-vs-actual.json'), JSON.stringify(failure.expectedCheck ?? {}, null, 2), 'utf-8');
    const resolved = (resolution ?? {}) as Record<string, unknown>;
    await writeFile(path.join(dir, 'site-profile.json'), JSON.stringify(resolved.profile ?? {}, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'page-readiness.json'), JSON.stringify(resolved.readiness ?? {}, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'retry-trace.json'), JSON.stringify(resolved.tracker ?? [], null, 2), 'utf-8');
    await writeFile(path.join(dir, 'banner-detection.json'), JSON.stringify(resolved.banner ?? {}, null, 2), 'utf-8');
    await writeFile(path.join(dir, 'state-transition-log.json'), JSON.stringify(resolved.tracker ?? [], null, 2), 'utf-8');
  }
}

export async function runScenario(
  deps: ConstructorParameters<typeof ScenarioRunner>[0],
  scenario: Scenario,
  options: ScenarioRunnerOptions,
): Promise<ReplayResult> {
  return new ScenarioRunner(deps).runScenario(scenario, options);
}
