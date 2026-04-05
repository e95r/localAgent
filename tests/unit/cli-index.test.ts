import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  parseCliArgs: vi.fn(),
  executeCliCommand: vi.fn(),
}));

vi.mock('../../src/config/runtime-config.js', () => ({
  loadRuntimeConfig: () => ({ defaultScenariosDir: '.', defaultLibraryDir: '.', artifactsDir: '.', jsonOutputDefault: false }),
}));

vi.mock('../../src/cli/arg-parser.js', () => ({
  parseCliArgs: mocks.parseCliArgs,
  CLI_HELP: 'help text',
}));

vi.mock('../../src/cli/runtime.js', () => ({
  executeCliCommand: mocks.executeCliCommand,
  mapCliErrorToExitCode: () => 1,
}));

import { runCli } from '../../src/cli/index.js';

describe('cli index output handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.parseCliArgs.mockReset();
    mocks.executeCliCommand.mockReset();
  });

  it('prints runtime output for json command responses', async () => {
    mocks.parseCliArgs.mockReturnValue({ command: 'replay', json: true });
    mocks.executeCliCommand.mockResolvedValue({ exitCode: 0, output: '{"ok":true}' });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runCli(['replay', '--json'], { printOutput: true });

    expect(exitCode).toBe(0);
    expect(stdoutSpy).toHaveBeenCalledWith('{"ok":true}\n');
  });

  it('does not print blank runtime output', async () => {
    mocks.parseCliArgs.mockReturnValue({ command: 'replay', json: false });
    mocks.executeCliCommand.mockResolvedValue({ exitCode: 0, output: '   ' });
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exitCode = await runCli(['replay'], { printOutput: true });

    expect(exitCode).toBe(0);
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
