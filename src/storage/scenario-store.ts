import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SCENARIO_SCHEMA_VERSION, type Scenario } from '../scenario/types.js';
import { validateScenarioSchema } from '../scenario/schema.js';

export class ScenarioStore {
  async saveScenarioToFile(filePath: string, scenario: Scenario): Promise<void> {
    const normalized: Scenario = {
      ...scenario,
      schemaVersion: scenario.schemaVersion ?? SCENARIO_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
    };
    validateScenarioSchema(normalized);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
  }

  async loadScenarioFromFile(filePath: string): Promise<Scenario> {
    const raw = await readFile(filePath, 'utf-8');
    return validateScenarioSchema(JSON.parse(raw));
  }
}

export async function saveScenarioToFile(filePath: string, scenario: Scenario): Promise<void> {
  return new ScenarioStore().saveScenarioToFile(filePath, scenario);
}

export async function loadScenarioFromFile(filePath: string): Promise<Scenario> {
  return new ScenarioStore().loadScenarioFromFile(filePath);
}
