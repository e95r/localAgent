import { SCENARIO_SCHEMA_VERSION, type Scenario, type ScenarioStep } from '../../scenario/types.js';

export function makeBaseScenario(name: string, startUrl: string, steps: ScenarioStep[], description: string): Scenario {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: `${name}-${Date.now()}`,
    name,
    createdAt: now,
    updatedAt: now,
    metadata: { sourceUrl: startUrl, startUrl, description, tags: ['library'] },
    steps,
  };
}

export function requireParam(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing required param: ${name}`);
  return value;
}
