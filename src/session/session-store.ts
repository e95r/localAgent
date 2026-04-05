import path from 'node:path';
import { AuthStateLoader } from './auth-state-loader.js';
import type { SessionProfile } from './types.js';

export interface SessionLookupResult {
  storageStatePath?: string;
  profile: SessionProfile;
  exists: boolean;
  expired: boolean;
  reason?: string;
  metadata: Record<string, unknown>;
}

export class SessionStore {
  constructor(private readonly loader = new AuthStateLoader()) {}

  async resolve(sessionFile: string | undefined, profile: SessionProfile = { name: 'default' }): Promise<SessionLookupResult> {
    if (!sessionFile) {
      return {
        profile,
        exists: false,
        expired: false,
        reason: 'session-file-not-configured',
        metadata: { profile: profile.name, domain: profile.domain, status: 'missing' },
      };
    }

    const normalized = path.resolve(sessionFile);
    const loaded = await this.loader.load(normalized, profile.name, profile.domain);
    return {
      profile,
      storageStatePath: loaded.storageStatePath,
      exists: loaded.exists,
      expired: loaded.expired,
      reason: loaded.reason,
      metadata: loaded.metadata as unknown as Record<string, unknown>,
    };
  }
}
