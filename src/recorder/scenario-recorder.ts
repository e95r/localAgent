import { randomUUID } from 'node:crypto';
import type { InteractiveElement, PageState } from '../types/page-state.js';
import type { RecordedTargetSnapshot, Scenario, ScenarioActionType, ScenarioStep } from '../scenario/types.js';
import { SCENARIO_SCHEMA_VERSION } from '../scenario/types.js';

export class ScenarioRecorder {
  private scenario?: Scenario;

  startRecording(name: string, startUrl: string, description?: string): Scenario {
    const now = new Date().toISOString();
    this.scenario = {
      schemaVersion: SCENARIO_SCHEMA_VERSION,
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      metadata: {
        sourceUrl: startUrl,
        startUrl,
        description,
      },
      steps: [],
    };
    return this.scenario;
  }

  recordStep(input: {
    actionType: ScenarioActionType;
    pageState: PageState;
    target?: InteractiveElement;
    value?: string;
    mode?: 'button' | 'enter';
    semanticIntent?: string;
    expectedOutcome?: string;
    postActionExpectation?: ScenarioStep['postActionExpectation'];
  }): ScenarioStep {
    if (!this.scenario) throw new Error('Recording has not started');

    const step: ScenarioStep = {
      stepId: `step-${this.scenario.steps.length + 1}`,
      action: {
        actionType: input.actionType,
        value: input.value,
        mode: input.mode,
      },
      pageUrlAtRecordTime: input.pageState.url,
      target: input.target ? toTargetSnapshot(input.target) : undefined,
      semanticIntent: input.semanticIntent,
      expectedOutcome: input.expectedOutcome,
      postActionExpectation: input.postActionExpectation,
    };

    this.scenario.steps.push(step);
    this.scenario.updatedAt = new Date().toISOString();
    return step;
  }

  stopRecording(): Scenario {
    if (!this.scenario) throw new Error('Recording has not started');
    return this.scenario;
  }
}

export function toTargetSnapshot(target: InteractiveElement): RecordedTargetSnapshot {
  return {
    targetId: target.id,
    selectorHint: target.selectorHint,
    strictSelectors: [target.selectorHint].filter(Boolean),
    fallbackSelectors: [`[data-agent-id="${target.id}"]`, target.tag, target.role ? `[role="${target.role}"]` : ''].filter(Boolean),
    tag: target.tag,
    role: target.role,
    text: target.text,
    ariaLabel: target.ariaLabel,
    href: target.href,
    placeholder: target.placeholder,
    nearestTextContext: target.nearestTextContext,
    containerHint: target.containerHint,
    domSnippet: target.domSnippet,
    visible: target.visible,
    enabled: target.enabled,
    clickable: target.clickable,
    boundingBox: target.boundingBox,
  };
}
