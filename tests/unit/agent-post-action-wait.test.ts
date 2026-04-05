import { describe, expect, it, vi } from 'vitest';
import type { BrowserExecutor } from '../../src/executor/browser-executor.js';
import { BrowserAgent } from '../../src/agent/agent.js';
import type { AgentAction, Planner } from '../../src/types/actions.js';
import type { PageObserver } from '../../src/observer/page-observer.js';
import type { ActionValidator } from '../../src/validator/action-validator.js';
import { makeElement, makeState } from './helpers.js';

class StubExecutor implements BrowserExecutor {
  clickElement = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  downloadFile = vi.fn(async () => { throw new Error('not implemented'); });
  extractText = vi.fn(async () => '');
  getCurrentUrl = vi.fn(async () => 'http://example.test');
  getPage = vi.fn(() => ({}) as any);
  getPageHtml = vi.fn(async () => '<html></html>');
  getPageTitle = vi.fn(async () => 'title');
  openUrl = vi.fn(async () => undefined);
  pressEnter = vi.fn(async () => undefined);
  takeScreenshot = vi.fn(async () => undefined);
  typeText = vi.fn(async () => undefined);
  waitForElement = vi.fn(async () => undefined);
  waitForPageSettled = vi.fn(async () => undefined);
}

function makeAgent(action: AgentAction, executor = new StubExecutor()): BrowserAgent {
  const planner: Planner = { decide: vi.fn(async () => action) };
  const observer: PageObserver = {
    collect: vi.fn(async () =>
      makeState([
        makeElement({ id: 'el-click', selectorHint: '#click' }),
        makeElement({ id: 'el-submit', selectorHint: '#submit' }),
        makeElement({ id: 'el-input', selectorHint: '#input' }),
      ]),
    ),
  };
  const validator: ActionValidator = { validate: vi.fn() };

  return new BrowserAgent({ executor, observer, planner, validator });
}

describe('BrowserAgent post-action wait orchestration', () => {
  it('click action triggers post-action wait hook', async () => {
    const executor = new StubExecutor();
    const agent = makeAgent({ type: 'click', targetId: 'el-click' }, executor);

    await agent.run('click', 'http://example.test', 1);

    expect(executor.clickElement).toHaveBeenCalledWith('#click');
    expect(executor.waitForPageSettled).toHaveBeenCalledOnce();
  });

  it('submit_search action triggers post-action wait hook', async () => {
    const executor = new StubExecutor();
    const agent = makeAgent({ type: 'submit_search', targetId: 'el-submit', mode: 'button' }, executor);

    await agent.run('submit', 'http://example.test', 1);

    expect(executor.clickElement).toHaveBeenCalledWith('#submit');
    expect(executor.waitForPageSettled).toHaveBeenCalledOnce();
  });

  it('non-navigation action keeps fast path without wait hook', async () => {
    const executor = new StubExecutor();
    const agent = makeAgent({ type: 'type', targetId: 'el-input', text: 'cats' }, executor);

    await agent.run('type', 'http://example.test', 1);

    expect(executor.typeText).toHaveBeenCalledWith('#input', 'cats');
    expect(executor.waitForPageSettled).not.toHaveBeenCalled();
  });

  it('wait helper handles no-navigation timeout gracefully', async () => {
    const { PlaywrightBrowserExecutor } = await import('../../src/executor/browser-executor.js');
    const executor = new PlaywrightBrowserExecutor() as any;
    const pageMock = {
      url: vi.fn(() => 'http://example.test'),
      waitForURL: vi.fn(async () => {
        throw new Error('timeout');
      }),
      waitForLoadState: vi.fn(async () => undefined),
    };
    executor.page = pageMock;

    await expect(executor.waitForPageSettled('http://example.test', 20)).resolves.toBeUndefined();
    expect(pageMock.waitForLoadState).toHaveBeenCalledTimes(2);
    expect(pageMock.waitForLoadState).toHaveBeenNthCalledWith(1, 'domcontentloaded', { timeout: 20 });
    expect(pageMock.waitForLoadState).toHaveBeenNthCalledWith(2, 'load', { timeout: 20 });
  });
});
