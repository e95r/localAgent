import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SessionStore } from '../../src/session/session-store.js';
import { SiteProfileRegistry } from '../../src/profiles/site-profile-registry.js';

describe('session and profile', () => {
  it('loads valid session metadata', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'session-meta-'));
    try {
      const file = path.join(tmp, 'state.json');
      await writeFile(file, JSON.stringify({ cookies: [], origins: [] }), 'utf-8');
      await writeFile(`${file}.meta.json`, JSON.stringify({ expired: false }), 'utf-8');
      const result = await new SessionStore().resolve(file, { name: 'default' });
      expect(result.exists).toBe(true);
      expect(result.expired).toBe(false);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('handles missing session file', async () => {
    const result = await new SessionStore().resolve('/tmp/nope-session.json', { name: 'default' });
    expect(result.exists).toBe(false);
    expect(result.reason).toContain('missing');
  });

  it('recognizes expired session metadata', async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'session-expired-'));
    try {
      const file = path.join(tmp, 'state.json');
      await writeFile(file, JSON.stringify({ cookies: [], origins: [] }), 'utf-8');
      await writeFile(`${file}.meta.json`, JSON.stringify({ expired: true, reason: 'expired-token' }), 'utf-8');
      const result = await new SessionStore().resolve(file, { name: 'default' });
      expect(result.expired).toBe(true);
      expect(result.reason).toBe('expired-token');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('returns specific profile and falls back to generic', () => {
    const registry = new SiteProfileRegistry();
    expect(registry.resolve('http://x/realworld/dashboard-like-page.html').name).toBe('fixture-dashboard');
    expect(registry.resolve('http://x/unknown-page.html').name).toBe('generic');
  });

});
