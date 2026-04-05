import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PlaywrightBrowserExecutor } from '../executor/browser-executor.js';
import { DOMPageObserver } from '../observer/page-observer.js';
import { DefaultActionValidator } from '../validator/action-validator.js';
import { ScenarioRunner } from '../replay/scenario-runner.js';
import { ScenarioStore } from '../storage/scenario-store.js';
import { ScenarioRecorder } from '../recorder/scenario-recorder.js';
import { ApprovalPolicy } from '../approval/approval-policy.js';
import { ConsoleApprovalPrompter, formatApprovalPrompt } from '../approval/console-approval-prompter.js';
import type { ApprovalPrompter } from '../approval/approval-prompter.js';
import { ScenarioLibrary } from '../library/scenario-library.js';
import type { CliCommand, CliRunSummary, CliStepSummary } from './types.js';
import type { RuntimeConfig } from '../config/runtime-config.js';

export interface CliRuntimeDeps {
  prompter?: ApprovalPrompter;
  stdout?: Pick<typeof process.stdout, 'write'>;
}

export async function executeCliCommand(command: CliCommand, config: RuntimeConfig, deps: CliRuntimeDeps = {}): Promise<{ exitCode: number; output: string; summary?: CliRunSummary }> {
  const out = deps.stdout ?? process.stdout;
  const store = new ScenarioStore();
  const library = new ScenarioLibrary(config.defaultLibraryDir);

  if (command.command === 'list-scenarios') {
    const dir = command.dir ?? config.defaultScenariosDir;
    const files = await readdir(dir).catch(() => []);
    const scenarios = files.filter((f) => f.endsWith('.json'));
    return { exitCode: 0, output: JSON.stringify({ scenarios }) };
  }

  if (command.command === 'show-scenario') {
    const scenario = await store.loadScenarioFromFile(command.file);
    return { exitCode: 0, output: JSON.stringify(scenario, null, 2) };
  }

  if (command.command === 'record') {
    const recorder = new ScenarioRecorder();
    recorder.startRecording(command.name, command.url, 'Recorded from CLI');
    recorder.recordStep({ actionType: 'open_url', pageState: { url: command.url, title: command.name, interactiveElements: [], visibleText: '' }, value: command.url });
    recorder.recordStep({ actionType: 'finish', pageState: { url: command.url, title: command.name, interactiveElements: [], visibleText: '' }, value: 'Recorded stub scenario' });
    const scenario = recorder.stopRecording();
    const file = command.file ?? path.join(config.defaultScenariosDir, `${scenario.id}.json`);
    await store.saveScenarioToFile(file, scenario);
    return { exitCode: 0, output: JSON.stringify({ saved: file }) };
  }

  if (command.command === 'help') return { exitCode: 0, output: '' };

  const scenario = command.command === 'replay'
    ? await store.loadScenarioFromFile(command.file)
    : library.buildByName(command.scenarioName, command.params);

  const artifactsRoot = command.artifactsDir;
  await mkdir(artifactsRoot, { recursive: true });
  if (command.command === 'run-library-scenario') {
    await library.writeMetadataArtifact(path.join(artifactsRoot, 'library-scenario-metadata.json'), command.scenarioName);
  }

  const timeline: CliStepSummary[] = [];
  let approvalRequested = false;
  const prompter = deps.prompter ?? new ConsoleApprovalPrompter();
  const approvalPolicy = new ApprovalPolicy(command.approval);

  const executor = new PlaywrightBrowserExecutor();
  try {
    const runner = new ScenarioRunner({ executor, observer: new DOMPageObserver(), validator: new DefaultActionValidator() });
    const replay = await runner.runScenario(scenario, {
      mode: command.mode,
      debugArtifacts: { enabled: true, outputDir: artifactsRoot },
      approvalHandler: async ({ scenario, stepIndex, confidence, strategy }) => {
        const step = scenario.steps[stepIndex];
        const decision = approvalPolicy.evaluate({ step, confidence, strategy, currentUrl: await executor.getCurrentUrl(), source: 'scenario-runner' });
        if (!decision.requiresApproval) return { approved: true, outcome: 'not-required' as const, decision };
        approvalRequested = true;
        const prompt = formatApprovalPrompt(decision.request);
        const response = await prompter.prompt(decision.request);
        await writeFile(path.join(artifactsRoot, 'approval-prompt.txt'), prompt, 'utf-8');
        await writeFile(path.join(artifactsRoot, 'approval-decision.json'), JSON.stringify({ request: decision.request, response }, null, 2), 'utf-8');
        return { approved: response.approved, outcome: response.approved ? 'approved' as const : 'rejected' as const, prompt, decision: { request: decision.request, response } };
      },
      onStepComplete: (step) => timeline.push(step),
    });

    const summary: CliRunSummary = {
      scenarioName: scenario.name,
      mode: command.mode,
      steps: scenario.steps.length,
      success: replay.success,
      approvalRequested,
      artifactsDir: artifactsRoot,
      timeline,
      replay,
      scenario,
    };

    await writeFile(path.join(artifactsRoot, 'execution-timeline.json'), JSON.stringify(timeline, null, 2), 'utf-8');
    await writeFile(path.join(artifactsRoot, 'cli-run-summary.json'), JSON.stringify(summary, null, 2), 'utf-8');

    const output = command.json
      ? JSON.stringify(summary, null, 2)
      : [
          `Scenario: ${summary.scenarioName}`,
          `Mode: ${summary.mode}`,
          `Steps: ${summary.steps}`,
          `Success: ${summary.success}`,
          `Approval requested: ${summary.approvalRequested}`,
          `Artifacts: ${summary.artifactsDir}`,
        ].join('\n');
    out.write(`${output}\n`);
    return { exitCode: replay.success ? 0 : 2, output, summary };
  } finally {
    await executor.close();
  }
}

export function mapCliErrorToExitCode(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('requires')) return 2;
  if (message.includes('Unknown command')) return 2;
  return 1;
}

export async function loadScenarioList(dir: string): Promise<string[]> {
  const entries = await readdir(dir).catch(() => []);
  return entries.filter((file) => file.endsWith('.json')).sort();
}

export async function loadScenarioPreview(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8');
}
