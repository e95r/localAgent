export type SessionStatus = 'loaded' | 'missing' | 'expired' | 'error';

export interface SessionStateMeta {
  profile: string;
  domain?: string;
  loadedAt: string;
  sourceFile?: string;
  status: SessionStatus;
  reason?: string;
}

export interface SessionProfile {
  name: string;
  domain?: string;
}
