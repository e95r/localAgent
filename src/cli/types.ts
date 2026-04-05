import type { ApprovalMode } from '../approval/approval-prompter.js';
import type { ReplayMode, ReplayResult, Scenario } from '../scenario/types.js';

export type CliCommandName = 'record' | 'replay' | 'list-scenarios' | 'show-scenario' | 'run-library-scenario' | 'help';

export interface CliCommonOptions {
  mode: ReplayMode;
  approval: ApprovalMode;
  useLlm: boolean;
  artifactsDir: string;
  json: boolean;
  sessionFile?: string;
  siteProfile?: string;
  review?: 'compact' | 'verbose';
  maxRetries?: number;
  waitStrategy?: 'auto' | 'fast' | 'stable';
  autoConsent?: boolean;
}

export type CliCommand =
  | ({ command: 'record'; name: string; url: string; file?: string } & CliCommonOptions)
  | ({ command: 'replay'; file: string } & CliCommonOptions)
  | ({ command: 'list-scenarios'; dir?: string } & CliCommonOptions)
  | ({ command: 'show-scenario'; file: string } & CliCommonOptions)
  | ({ command: 'run-library-scenario'; scenarioName: string; params: Record<string, string> } & CliCommonOptions)
  | ({ command: 'help' } & CliCommonOptions);

export interface CliStepSummary {
  stepId: string;
  actionType: string;
  target: string;
  result: 'success' | 'failure';
  durationMs: number;
  plannerSource: string;
  approvalOutcome: 'not-required' | 'approved' | 'rejected';
}

export interface CliRunSummary {
  scenarioName: string;
  mode: ReplayMode;
  steps: number;
  success: boolean;
  approvalRequested: boolean;
  artifactsDir?: string;
  timeline: CliStepSummary[];
  replay?: ReplayResult;
  scenario?: Scenario;
}
