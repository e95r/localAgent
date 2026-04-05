#!/usr/bin/env node
import { loadRuntimeConfig } from '../config/runtime-config.js';
import { parseCliArgs, CLI_HELP } from './arg-parser.js';
import { executeCliCommand, mapCliErrorToExitCode } from './runtime.js';

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  const config = loadRuntimeConfig();
  try {
    const command = parseCliArgs(argv, config);
    if (command.command === 'help') {
      process.stdout.write(`${CLI_HELP}\n`);
      return 0;
    }
    const result = await executeCliCommand(command, config);
    if (result.output.trim().length > 0) process.stdout.write(`${result.output}\n`);
    return result.exitCode;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.stderr.write(`${CLI_HELP}\n`);
    return mapCliErrorToExitCode(error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
