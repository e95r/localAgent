import type { ScenarioActionType } from '../scenario/types.js';

export type ApprovalMode = 'never' | 'risky-only' | 'always';

export interface ApprovalRequest {
  stepId: string;
  actionType: ScenarioActionType;
  targetSummary: string;
  reason: string;
  riskLevel: 'safe' | 'medium' | 'high';
  confidence: number;
  source: string;
}

export interface ApprovalResponse {
  approved: boolean;
  answer: 'approved' | 'rejected';
  note?: string;
}

export interface ApprovalPrompter {
  prompt(request: ApprovalRequest): Promise<ApprovalResponse>;
}

export class FakeApprovalPrompter implements ApprovalPrompter {
  constructor(private readonly handler: (request: ApprovalRequest) => ApprovalResponse | Promise<ApprovalResponse>) {}

  async prompt(request: ApprovalRequest): Promise<ApprovalResponse> {
    return this.handler(request);
  }
}
