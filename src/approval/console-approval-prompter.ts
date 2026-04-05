import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { ApprovalPrompter, ApprovalRequest, ApprovalResponse } from './approval-prompter.js';

export class ConsoleApprovalPrompter implements ApprovalPrompter {
  async prompt(request: ApprovalRequest): Promise<ApprovalResponse> {
    const rl = readline.createInterface({ input, output });
    try {
      output.write([
        '\nApproval required:',
        `- Step: ${request.stepId}`,
        `- Action: ${request.actionType}`,
        `- Target: ${request.targetSummary}`,
        `- Risk: ${request.riskLevel}`,
        `- Reason: ${request.reason}`,
        `- Confidence: ${request.confidence.toFixed(2)}`,
        `- Source: ${request.source}`,
        'Approve? (y/N): ',
      ].join('\n'));
      const answer = (await rl.question('')).trim().toLowerCase();
      const approved = answer === 'y' || answer === 'yes';
      return { approved, answer: approved ? 'approved' : 'rejected', note: answer };
    } finally {
      rl.close();
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
