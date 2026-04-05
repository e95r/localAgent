import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/arg-parser.js';
import { DEFAULT_RUNTIME_CONFIG } from '../../src/config/runtime-config.js';

describe('cli arg parser', () => {
  it('parses record command args', () => {
    const command = parseCliArgs(['record', '--name', 'Search docs', '--url', 'http://x'], DEFAULT_RUNTIME_CONFIG);
    expect(command.command).toBe('record');
    if (command.command === 'record') {
      expect(command.name).toBe('Search docs');
      expect(command.url).toBe('http://x');
    }
  });

  it('parses replay command args', () => {
    const command = parseCliArgs(['replay', '--file', 'scenarios/a.json', '--mode', 'adaptive', '--approval', 'always'], DEFAULT_RUNTIME_CONFIG);
    expect(command.command).toBe('replay');
    if (command.command === 'replay') {
      expect(command.mode).toBe('adaptive');
      expect(command.approval).toBe('always');
      expect(command.file).toContain('a.json');
    }
  });

  it('rejects invalid args with helpful error', () => {
    expect(() => parseCliArgs(['replay'], DEFAULT_RUNTIME_CONFIG)).toThrow(/requires --file/);
  });

  it('parses library params key value format', () => {
    const command = parseCliArgs(['run-library-scenario', 'download-file', '--param', 'startUrl=http://x', '--param', 'targetKeyword=Download'], DEFAULT_RUNTIME_CONFIG);
    expect(command.command).toBe('run-library-scenario');
    if (command.command === 'run-library-scenario') {
      expect(command.params.startUrl).toBe('http://x');
      expect(command.params.targetKeyword).toBe('Download');
    }
  });
});
