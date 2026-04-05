import type { ReplayMode, Scenario, ScenarioActionType, ScenarioStep } from './types.js';
import { SCENARIO_SCHEMA_VERSION } from './types.js';

const validActionTypes = new Set<ScenarioActionType>(['click', 'type', 'submit_search', 'extract_text', 'wait_for', 'open_url', 'finish']);
const validReplayModes = new Set<ReplayMode>(['strict', 'adaptive']);

export class ScenarioValidationError extends Error {}

export function validateScenarioSchema(input: unknown): Scenario {
  if (!input || typeof input !== 'object') throw new ScenarioValidationError('Scenario must be an object');
  const scenario = input as Partial<Scenario>;
  if (!scenario.id || !scenario.name) throw new ScenarioValidationError('Scenario id and name are required');
  if (!scenario.createdAt || !scenario.updatedAt) throw new ScenarioValidationError('Scenario timestamps are required');
  if (!scenario.metadata?.startUrl || !scenario.metadata?.sourceUrl) throw new ScenarioValidationError('Scenario metadata.startUrl and metadata.sourceUrl are required');
  if (!Array.isArray(scenario.steps)) throw new ScenarioValidationError('Scenario steps must be an array');

  for (const step of scenario.steps) validateStep(step as ScenarioStep);

  return {
    ...scenario,
    schemaVersion: scenario.schemaVersion ?? SCENARIO_SCHEMA_VERSION,
  } as Scenario;
}

function validateStep(step: ScenarioStep): void {
  if (!step?.stepId) throw new ScenarioValidationError('Each step requires stepId');
  if (!step.pageUrlAtRecordTime) throw new ScenarioValidationError(`Step ${step.stepId} requires pageUrlAtRecordTime`);
  if (!step.action?.actionType || !validActionTypes.has(step.action.actionType)) {
    throw new ScenarioValidationError(`Step ${step.stepId} has invalid actionType`);
  }
  if ((step.action.actionType === 'click' || step.action.actionType === 'type' || step.action.actionType === 'submit_search' || step.action.actionType === 'extract_text') && !step.target) {
    throw new ScenarioValidationError(`Step ${step.stepId} requires target`);
  }
  if (step.target) {
    if (!Array.isArray(step.target.strictSelectors)) throw new ScenarioValidationError(`Step ${step.stepId} target.strictSelectors must be array`);
    if (!Array.isArray(step.target.fallbackSelectors)) throw new ScenarioValidationError(`Step ${step.stepId} target.fallbackSelectors must be array`);
  }
}

export function assertKnownReplayMode(mode: string): ReplayMode {
  if (validReplayModes.has(mode as ReplayMode)) return mode as ReplayMode;
  throw new ScenarioValidationError(`Unknown replay mode: ${mode}`);
}
