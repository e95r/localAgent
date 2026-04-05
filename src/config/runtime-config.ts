import type { ApprovalMode } from '../approval/approval-prompter.js';
import type { ReplayMode } from '../scenario/types.js';

export interface RuntimeConfig {
  defaultScenariosDir: string;
  defaultLibraryDir: string;
  defaultReplayMode: ReplayMode;
  defaultApprovalMode: ApprovalMode;
  useLlmByDefault: boolean;
  artifactsDir: string;
  jsonOutputDefault: boolean;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  defaultScenariosDir: 'scenarios',
  defaultLibraryDir: 'scenarios/library',
  defaultReplayMode: 'strict',
  defaultApprovalMode: 'risky-only',
  useLlmByDefault: false,
  artifactsDir: 'artifacts',
  jsonOutputDefault: false,
};

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    defaultScenariosDir: env.BROWSER_AGENT_SCENARIOS_DIR ?? DEFAULT_RUNTIME_CONFIG.defaultScenariosDir,
    defaultLibraryDir: env.BROWSER_AGENT_LIBRARY_DIR ?? DEFAULT_RUNTIME_CONFIG.defaultLibraryDir,
    defaultReplayMode: (env.BROWSER_AGENT_REPLAY_MODE as ReplayMode) ?? DEFAULT_RUNTIME_CONFIG.defaultReplayMode,
    defaultApprovalMode: (env.BROWSER_AGENT_APPROVAL_MODE as ApprovalMode) ?? DEFAULT_RUNTIME_CONFIG.defaultApprovalMode,
    useLlmByDefault: parseBool(env.BROWSER_AGENT_USE_LLM, DEFAULT_RUNTIME_CONFIG.useLlmByDefault),
    artifactsDir: env.BROWSER_AGENT_ARTIFACTS_DIR ?? DEFAULT_RUNTIME_CONFIG.artifactsDir,
    jsonOutputDefault: parseBool(env.BROWSER_AGENT_JSON_OUTPUT, DEFAULT_RUNTIME_CONFIG.jsonOutputDefault),
  };
}
