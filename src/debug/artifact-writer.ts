import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentAction } from '../types/actions.js';
import type { PageState } from '../types/page-state.js';
import type { BrowserExecutor } from '../executor/browser-executor.js';

export interface ArtifactConfig {
  enabled: boolean;
  outputDir: string;
}

export async function writeDebugArtifacts(params: {
  config: ArtifactConfig;
  executor: BrowserExecutor;
  pageState: PageState;
  plannerOutput: AgentAction;
  validatorResult: { ok: boolean; error?: string };
  actionHistory: AgentAction[];
  reason: string;
}): Promise<string | null> {
  if (!params.config.enabled) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(params.config.outputDir, `${timestamp}-${params.reason}`);
  await mkdir(dir, { recursive: true });

  await params.executor.takeScreenshot(path.join(dir, 'screenshot.png'));
  await writeFile(path.join(dir, 'current.html'), await params.executor.getPageHtml(), 'utf-8');
  await writeFile(path.join(dir, 'page-state.json'), JSON.stringify(params.pageState, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'planner-output.json'), JSON.stringify(params.plannerOutput, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'validator-result.json'), JSON.stringify(params.validatorResult, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'action-history.json'), JSON.stringify(params.actionHistory, null, 2), 'utf-8');

  return dir;
}
