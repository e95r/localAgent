#!/usr/bin/env node
import { loadRuntimeConfig } from '../config/runtime-config.js';
import { parseCliArgs, CLI_HELP } from './arg-parser.js';
import { executeCliCommand, mapCliErrorToExitCode } from './runtime.js';

export interface RunCliOptions {
  printOutput?: boolean;
  stdout?: Pick<NodeJS.WriteStream, 'write'>;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
}

export async function runCli(argv = process.argv.slice(2), options: RunCliOptions = {}): Promise<number> {
  const config = loadRuntimeConfig();
  const isDirectInvocation = import.meta.url === `file://${process.argv[1]}`;
  const printOutput = options.printOutput ?? isDirectInvocation;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  try {
    const command = parseCliArgs(argv, config);
    if (command.command === 'help') {
      if (printOutput) stdout.write(`${CLI_HELP}\n`);
      return 0;
    }
    const result = await executeCliCommand(command, config);
    if (printOutput && result.output.trim().length > 0) stdout.write(`${result.output}\n`);
    return result.exitCode;
  } catch (error) {
    if (printOutput) {
      stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      stderr.write(`${CLI_HELP}\n`);
    }
    return mapCliErrorToExitCode(error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2), { printOutput: true }).then((code) => {
    process.exitCode = code;
  });
}
