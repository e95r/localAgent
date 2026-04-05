import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentAction } from '../types/actions.js';
import type { PageState } from '../types/page-state.js';
import type { BrowserExecutor } from '../executor/browser-executor.js';

export interface ArtifactConfig {
  enabled: boolean;
  outputDir: string;
}

export interface LlmArtifactPayload {
  prompt?: string;
  rawResponse?: string;
  sanitizedRawResponse?: string;
  parsedResponse?: unknown;
  clientMetadata?: Record<string, unknown>;
  parseErrorReason?: string;
}

export async function writeDebugArtifacts(params: {
  config: ArtifactConfig;
  executor: BrowserExecutor;
  pageState: PageState;
  plannerOutput: AgentAction;
  validatorResult: { ok: boolean; error?: string };
  actionHistory: AgentAction[];
  reason: string;
  llmArtifacts?: LlmArtifactPayload;
}): Promise<string | null> {
  if (!params.config.enabled) return null;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(params.config.outputDir, `${timestamp}-${params.reason}`);
  await mkdir(dir, { recursive: true });

  await params.executor.takeScreenshot(path.join(dir, 'screenshot.png'));
  await writeFile(path.join(dir, 'current.html'), await params.executor.getPageHtml(), 'utf-8');
  await writeFile(path.join(dir, 'page-state.json'), JSON.stringify(params.pageState, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'planner-output.json'), JSON.stringify(params.plannerOutput, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'planner-source.json'), JSON.stringify({ source: params.plannerOutput.plannerSource ?? 'unknown' }, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'validator-result.json'), JSON.stringify(params.validatorResult, null, 2), 'utf-8');
  await writeFile(path.join(dir, 'action-history.json'), JSON.stringify(params.actionHistory, null, 2), 'utf-8');

  if (params.llmArtifacts) {
    if (params.llmArtifacts.prompt) await writeFile(path.join(dir, 'llm-prompt.txt'), params.llmArtifacts.prompt, 'utf-8');
    if (params.llmArtifacts.rawResponse) await writeFile(path.join(dir, 'llm-raw-response.txt'), params.llmArtifacts.rawResponse, 'utf-8');
    if (params.llmArtifacts.parsedResponse !== undefined) {
      await writeFile(path.join(dir, 'llm-parsed-response.json'), JSON.stringify(params.llmArtifacts.parsedResponse, null, 2), 'utf-8');
    }
    if (params.llmArtifacts.sanitizedRawResponse) await writeFile(path.join(dir, 'llm-sanitized-response.txt'), params.llmArtifacts.sanitizedRawResponse, 'utf-8');
    if (params.llmArtifacts.clientMetadata) await writeFile(path.join(dir, 'llm-client-metadata.json'), JSON.stringify(params.llmArtifacts.clientMetadata, null, 2), 'utf-8');
    if (params.llmArtifacts.parseErrorReason) await writeFile(path.join(dir, 'llm-parse-error.txt'), params.llmArtifacts.parseErrorReason, 'utf-8');
  }

  return dir;
}
