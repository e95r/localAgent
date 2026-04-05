import { describe, expect, it } from 'vitest';
import { verifyPostStepExpectation } from '../../src/replay/post-step-verifier.js';

describe('post-step verification', () => {
  const executor = {
    getCurrentUrl: async () => 'http://x/page',
    getPageTitle: async () => 'My page',
    getPageHtml: async () => '<div>Hello</div>',
  } as any;

  it('detects URL mismatch', async () => {
    const check = await verifyPostStepExpectation(executor, { urlIncludes: '/wrong' });
    expect(check.passed).toBeFalsy();
  });

  it('detects missing expected text', async () => {
    const check = await verifyPostStepExpectation(executor, { textVisible: 'Missing' });
    expect(check.passed).toBeFalsy();
  });
});
