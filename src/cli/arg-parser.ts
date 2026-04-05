import type { RuntimeConfig } from '../config/runtime-config.js';
import type { ApprovalMode } from '../approval/approval-prompter.js';
import type { ReplayMode } from '../scenario/types.js';
import type { CliCommand, CliCommonOptions } from './types.js';

function readFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function readBoolean(args: string[], flag: string, fallback: boolean): boolean {
  const value = readFlag(args, flag);
  if (value === undefined) return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}

function parseParams(args: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  args.forEach((token, idx) => {
    if (token !== '--param') return;
    const payload = args[idx + 1] ?? '';
    const [key, ...rest] = payload.split('=');
    if (!key || rest.length === 0) throw new Error(`Invalid --param value: ${payload}`);
    params[key] = rest.join('=');
  });
  return params;
}

function baseOptions(args: string[], cfg: RuntimeConfig): CliCommonOptions {
  const mode = (readFlag(args, '--mode') as ReplayMode | undefined) ?? cfg.defaultReplayMode;
  if (!['strict', 'adaptive'].includes(mode)) throw new Error(`Invalid --mode: ${mode}`);
  const approval = (readFlag(args, '--approval') as ApprovalMode | undefined) ?? cfg.defaultApprovalMode;
  if (!['never', 'risky-only', 'always'].includes(approval)) throw new Error(`Invalid --approval: ${approval}`);

  return {
    mode,
    approval,
    useLlm: readBoolean(args, '--use-llm', cfg.useLlmByDefault),
    artifactsDir: readFlag(args, '--artifacts-dir') ?? cfg.artifactsDir,
    json: args.includes('--json') || cfg.jsonOutputDefault,
  };
}

export function parseCliArgs(argv: string[], cfg: RuntimeConfig): CliCommand {
  const command = argv[0] ?? 'help';
  const common = baseOptions(argv, cfg);

  if (command === 'help' || command === '--help' || command === '-h') return { command: 'help', ...common };

  if (command === 'record') {
    const name = readFlag(argv, '--name');
    const url = readFlag(argv, '--url');
    if (!name) throw new Error('record requires --name');
    if (!url) throw new Error('record requires --url');
    return { command, name, url, file: readFlag(argv, '--file'), ...common };
  }

  if (command === 'replay') {
    const file = readFlag(argv, '--file') ?? readFlag(argv, '--scenario');
    if (!file) throw new Error('replay requires --file');
    return { command, file, ...common };
  }

  if (command === 'list-scenarios') {
    return { command, dir: readFlag(argv, '--dir'), ...common };
  }

  if (command === 'show-scenario') {
    const file = readFlag(argv, '--file');
    if (!file) throw new Error('show-scenario requires --file');
    return { command, file, ...common };
  }

  if (command === 'run-library-scenario') {
    const scenarioName = argv[1];
    if (!scenarioName || scenarioName.startsWith('--')) throw new Error('run-library-scenario requires scenario name');
    return { command, scenarioName, params: parseParams(argv), ...common };
  }

  throw new Error(`Unknown command: ${command}`);
}

export const CLI_HELP = `browser-agent-mvp CLI
Commands:
  record --name <name> --url <url> [--file <file>]
  replay --file <scenario.json> [--mode strict|adaptive]
  list-scenarios [--dir <path>]
  show-scenario --file <scenario.json>
  run-library-scenario <name> [--param key=value]

Common flags:
  --mode strict|adaptive
  --approval never|risky-only|always
  --use-llm true|false
  --artifacts-dir <path>
  --json
`;
