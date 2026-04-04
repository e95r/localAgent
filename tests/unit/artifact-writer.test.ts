import { mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeDebugArtifacts } from '../../src/debug/artifact-writer.js';
import { makeState } from './helpers.js';

describe('artifact serialization', () => {
  it('writes full artifact bundle', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'agent-artifacts-'));
    const artifactPath = await writeDebugArtifacts({
      config: { enabled: true, outputDir: dir },
      executor: {
        takeScreenshot: async (p: string) => {
          await import('node:fs/promises').then((m) => m.writeFile(p, 'x'));
        },
        getPageHtml: async () => '<html />',
      } as any,
      pageState: makeState([]),
      plannerOutput: { type: 'ask_user', question: 'q' },
      validatorResult: { ok: false, error: 'bad' },
      actionHistory: [],
      reason: 'ask',
    });

    expect(artifactPath).toBeTruthy();
    const files = await readdir(artifactPath!);
    expect(files).toContain('planner-output.json');
    expect(files).toContain('screenshot.png');
    await rm(dir, { recursive: true, force: true });
  });
});
