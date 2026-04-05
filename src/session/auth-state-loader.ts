import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SessionStateMeta } from './types.js';

export interface AuthStateLoadResult {
  storageStatePath?: string;
  exists: boolean;
  expired: boolean;
  reason?: string;
  metadata: SessionStateMeta;
}

export interface AuthStateSavePayload {
  profile: string;
  domain?: string;
  statePath: string;
  metaPath: string;
  source?: string;
  expired?: boolean;
  reason?: string;
}

export class AuthStateLoader {
  async load(statePath: string, profile = 'default', domain?: string): Promise<AuthStateLoadResult> {
    const metadata: SessionStateMeta = {
      profile,
      domain,
      loadedAt: new Date().toISOString(),
      sourceFile: statePath,
      status: 'missing',
    };

    try {
      await access(statePath);
    } catch {
      return { exists: false, expired: false, reason: 'session-file-missing', metadata };
    }

    let expired = false;
    let reason: string | undefined;

    const metaPath = `${statePath}.meta.json`;
    try {
      const raw = await readFile(metaPath, 'utf-8');
      const parsed = JSON.parse(raw) as { expired?: boolean; reason?: string };
      expired = Boolean(parsed.expired);
      reason = parsed.reason;
    } catch {
      // optional metadata
    }

    metadata.status = expired ? 'expired' : 'loaded';
    metadata.reason = reason;
    return {
      storageStatePath: statePath,
      exists: true,
      expired,
      reason,
      metadata,
    };
  }
}

export class AuthStateSaver {
  async save(payload: AuthStateSavePayload): Promise<void> {
    await mkdir(path.dirname(payload.metaPath), { recursive: true });
    const meta: SessionStateMeta & { expired?: boolean } = {
      profile: payload.profile,
      domain: payload.domain,
      loadedAt: new Date().toISOString(),
      sourceFile: payload.source ?? payload.statePath,
      status: payload.expired ? 'expired' : 'loaded',
      reason: payload.reason,
      expired: payload.expired,
    };
    await writeFile(payload.metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }
}
