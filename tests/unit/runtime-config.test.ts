import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNTIME_CONFIG, loadRuntimeConfig } from '../../src/config/runtime-config.js';

describe('runtime config', () => {
  it('provides defaults', () => {
    expect(loadRuntimeConfig({} as NodeJS.ProcessEnv)).toEqual(DEFAULT_RUNTIME_CONFIG);
  });

  it('reads env overrides', () => {
    const config = loadRuntimeConfig({
      BROWSER_AGENT_SCENARIOS_DIR: '/tmp/scenarios',
      BROWSER_AGENT_LIBRARY_DIR: '/tmp/lib',
      BROWSER_AGENT_REPLAY_MODE: 'adaptive',
      BROWSER_AGENT_APPROVAL_MODE: 'always',
      BROWSER_AGENT_USE_LLM: 'true',
      BROWSER_AGENT_ARTIFACTS_DIR: '/tmp/artifacts',
      BROWSER_AGENT_JSON_OUTPUT: 'true',
    });
    expect(config.defaultScenariosDir).toContain('/tmp/scenarios');
    expect(config.defaultReplayMode).toBe('adaptive');
    expect(config.defaultApprovalMode).toBe('always');
    expect(config.useLlmByDefault).toBe(true);
    expect(config.jsonOutputDefault).toBe(true);
  });
});
