import type { BrowserContextOptions } from 'playwright';
import type { SessionLookupResult } from './session-store.js';

export class BrowserSessionManager {
  toContextOptions(session: SessionLookupResult): BrowserContextOptions {
    if (session.exists && !session.expired && session.storageStatePath) {
      return { acceptDownloads: true, storageState: session.storageStatePath };
    }
    return { acceptDownloads: true };
  }
}
