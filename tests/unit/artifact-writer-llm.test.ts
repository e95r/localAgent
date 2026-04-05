import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeDebugArtifacts } from '../../src/debug/artifact-writer.js';
import { makeState } from './helpers.js';

describe('artifact writer llm extensions', () => {
  it('writes llm artifacts when provided', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-artifacts-llm-'));
    const artifactPath = await writeDebugArtifacts({
      config: { enabled: true, outputDir: dir },
      executor: {
        takeScreenshot: async (p: string) => { await import('node:fs/promises').then((m) => m.writeFile(p, 'x')); },
        getPageHtml: async () => '<html />',
      } as any,
      pageState: makeState([]),
      plannerOutput: { type: 'ask_user', question: 'q', plannerSource: 'hybrid-ask-user' },
      validatorResult: { ok: false },
      actionHistory: [],
      reason: 'ask',
      llmArtifacts: { prompt: 'p', rawResponse: '{"a":1}', sanitizedRawResponse: '{"a":1}', parsedResponse: { a: 1 }, clientMetadata: { model: 'qwen2.5:7b' }, parseErrorReason: 'none' },
    });

    const files = await readdir(artifactPath!);
    expect(files).toContain('llm-prompt.txt');
    expect(files).toContain('planner-source.json');
    expect(files).toContain('llm-client-metadata.json');
    expect(files).toContain('llm-sanitized-response.txt');
    await rm(dir, { recursive: true, force: true });
  });
});
