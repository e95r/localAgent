import { describe, expect, it } from 'vitest';
import { ConsentBannerResolver } from '../../src/banner/consent-resolver.js';
import { GENERIC_PROFILE } from '../../src/profiles/site-profile.js';

type Scope = 'page' | 'banner';

interface FakeElement {
  selector: string;
  text: string;
  visible: boolean;
  scope: Scope;
}

class FakeLocator {
  constructor(
    private readonly allElements: FakeElement[],
    private readonly current: FakeElement[],
    private readonly scope: Scope | 'containers' | 'any',
  ) {}

  locator(selector: string): FakeLocator {
    if (this.scope === 'containers') {
      return new FakeLocator(this.allElements, this.allElements.filter((el) => el.selector === selector && el.scope === 'banner'), 'banner');
    }
    const scoped = this.scope === 'any' ? this.allElements : this.allElements.filter((el) => el.scope === this.scope);
    return new FakeLocator(this.allElements, scoped.filter((el) => el.selector === selector), this.scope);
  }

  first(): FakeLocator {
    return new FakeLocator(this.allElements, this.current.length ? [this.current[0]] : [], this.scope);
  }

  nth(index: number): FakeLocator {
    return new FakeLocator(this.allElements, this.current[index] ? [this.current[index]] : [], this.scope);
  }

  async count(): Promise<number> {
    return this.current.length;
  }

  async isVisible(): Promise<boolean> {
    return Boolean(this.current[0]?.visible);
  }

  async textContent(): Promise<string> {
    return this.current[0]?.text ?? '';
  }

  async click(): Promise<void> {
    return;
  }
}

function makePage(elements: FakeElement[]): any {
  return {
    locator: (selector: string) => {
      const isBannerContainerQuery = selector.includes('[role="dialog"]') && selector.includes('newsletter');
      if (isBannerContainerQuery) {
        const containers = elements.filter((el) => el.scope === 'banner');
        return new FakeLocator(elements, containers, 'containers');
      }
      return new FakeLocator(elements, elements.filter((el) => el.selector === selector), 'any');
    },
  };
}

describe('consent resolver', () => {
  it('prefers modal close control over generic continue button', async () => {
    const resolver = new ConsentBannerResolver();
    const page = makePage([
      { selector: 'button:has-text("Continue")', text: 'Continue flow', visible: true, scope: 'page' },
      { selector: 'button:has-text("Close")', text: 'Close', visible: true, scope: 'banner' },
    ]);

    const detection = await resolver.detect(page, GENERIC_PROFILE);
    expect(detection.detected).toBe(true);
    expect(detection.action).toBe('close');
    expect(detection.selector).toBe('button:has-text("Close")');
  });

  it('does not classify main CTA outside modal as consent when modal exists', async () => {
    const resolver = new ConsentBannerResolver();
    const page = makePage([
      { selector: 'button:has-text("Continue")', text: 'Continue flow', visible: true, scope: 'page' },
      { selector: '[data-modal-close]', text: 'Dismiss', visible: true, scope: 'banner' },
    ]);

    const detection = await resolver.detect(page, GENERIC_PROFILE);
    expect(detection.detected).toBe(true);
    expect(detection.selector).toBe('[data-modal-close]');
    expect(detection.selectorScope).toBe('page');
  });

  it('uses banner scope for generic consent selectors when modal/banner is visible', async () => {
    const resolver = new ConsentBannerResolver();
    const profile = {
      ...GENERIC_PROFILE,
      modalCloseSelectors: [],
      consentSelectors: ['button:has-text("Continue")'],
    };
    const page = makePage([
      { selector: 'button:has-text("Continue")', text: 'Continue flow', visible: true, scope: 'page' },
      { selector: 'button:has-text("Continue")', text: 'Continue in modal', visible: true, scope: 'banner' },
    ]);

    const detection = await resolver.detect(page, profile);
    expect(detection.detected).toBe(true);
    expect(detection.selectorScope).toBe('banner');
  });
});
