import { describe, expect, it } from 'vitest';
import { ReplayTargetResolver } from '../../src/replay/target-resolver.js';

describe('replay target resolver', () => {
  it('strict resolver finds exact selector', async () => {
    const resolver = new ReplayTargetResolver();
    const page = {
      locator: (selector: string) => ({
        first: () => ({ count: async () => (selector === '#ok' ? 1 : 0) }),
      }),
    } as any;
    const result = await resolver.resolve(page, { strictSelectors: ['#ok'], fallbackSelectors: [] }, 'strict');
    expect(result.strategy).toBe('strict-selector');
  });

  it('adaptive resolver returns ambiguity when several candidates are equal', async () => {
    const resolver = new ReplayTargetResolver();
    const handle = {
      evaluate: async (fn: unknown) => {
        const text = String(fn);
        if (text.includes('snapshot')) return 5;
        return 'button';
      },
    };

    const page = {
      locator: (_selector: string) => ({
        first: () => ({ count: async () => 0 }),
        elementHandles: async () => [handle, handle],
      }),
    } as any;

    const result = await resolver.resolve(page, { strictSelectors: ['#missing'], fallbackSelectors: [], text: 'candidate' }, 'adaptive');
    expect(result.strategy).toBe('ask-user');
    expect(result.reason).toMatch(/Ambiguous/);
  });
});
