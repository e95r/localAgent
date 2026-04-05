import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import type { ApprovalPrompter, ApprovalRequest, ApprovalResponse } from './approval-prompter.js';

export class ConsoleApprovalPrompter implements ApprovalPrompter {
  constructor(
    private readonly streams: {
      input?: NodeJS.ReadableStream;
      output?: NodeJS.WritableStream;
    } = {},
  ) {}

  async prompt(request: ApprovalRequest): Promise<ApprovalResponse> {
    const promptInput = this.streams.input ?? input;
    const promptOutput = this.streams.output ?? output;
    const rl = readline.createInterface({
      input: promptInput,
      output: promptOutput,
      terminal: Boolean((promptInput as NodeJS.ReadStream).isTTY && (promptOutput as NodeJS.WriteStream).isTTY),
    });
    try {
      const question = [
        '\nApproval required:',
        `- Step: ${request.stepId}`,
        `- Action: ${request.actionType}`,
        `- Target: ${request.targetSummary}`,
        `- Risk: ${request.riskLevel}`,
        `- Reason: ${request.reason}`,
        `- Confidence: ${request.confidence.toFixed(2)}`,
        `- Source: ${request.source}`,
        'Approve? (y/N): ',
      ].join('\n');
      const answer = (await new Promise<string>((resolve, reject) => {
        rl.question(question, (value) => resolve(value));
        rl.once('error', reject);
      })).trim().toLowerCase();
      const approved = answer === 'y' || answer === 'yes';
      return { approved, answer: approved ? 'approved' : 'rejected', note: answer };
    } finally {
      rl.close();
      if ('pause' in promptInput && typeof promptInput.pause === 'function') {
        promptInput.pause();
      }
    }
  }
}

export function formatApprovalPrompt(request: ApprovalRequest): string {
  return [
    `step=${request.stepId}`,
    `action=${request.actionType}`,
    `target=${request.targetSummary}`,
    `risk=${request.riskLevel}`,
    `reason=${request.reason}`,
    `confidence=${request.confidence}`,
    `source=${request.source}`,
  ].join('\n');
}
