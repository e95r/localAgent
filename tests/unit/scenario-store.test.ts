import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadScenarioFromFile, saveScenarioToFile } from '../../src/storage/scenario-store.js';
import type { Scenario } from '../../src/scenario/types.js';

describe('scenario serialization/deserialization', () => {
  it('saves and loads scenario', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'scenario-store-'));
    const file = path.join(dir, 'scenario.json');
    const scenario: Scenario = {
      schemaVersion: '1.0.0',
      id: 's',
      name: 'serialize',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { sourceUrl: 'http://x', startUrl: 'http://x' },
      steps: [{ stepId: 'step-1', action: { actionType: 'open_url', value: 'http://x' }, pageUrlAtRecordTime: 'http://x' }],
    };

    await saveScenarioToFile(file, scenario);
    const loaded = await loadScenarioFromFile(file);
    expect(loaded.name).toBe('serialize');
    await rm(dir, { recursive: true, force: true });
  });
});
