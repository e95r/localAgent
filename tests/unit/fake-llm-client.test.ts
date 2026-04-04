import { describe, expect, it } from 'vitest';
import { FakeLlmClient } from '../../src/llm/fake-llm-client.js';

describe('FakeLlmClient', () => {
  it('returns responder payload', async () => {
    const client = new FakeLlmClient(() => '{"ok":true}');
    await expect(client.generateAction({} as any)).resolves.toContain('ok');
  });
});
