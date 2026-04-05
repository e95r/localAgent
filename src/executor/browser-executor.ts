import { chromium, type Browser, type BrowserContext, type Download, type Locator, type Page } from 'playwright';

export interface BrowserExecutor {
  openUrl(url: string): Promise<void>;
  clickElement(selector: string | Locator): Promise<void>;
  typeText(selector: string, text: string): Promise<void>;
  pressEnter(selector: string): Promise<void>;
  waitForPageSettled(previousUrl?: string, timeoutMs?: number): Promise<void>;
  extractText(selector: string): Promise<string>;
  getPageTitle(): Promise<string>;
  getCurrentUrl(): Promise<string>;
  getPageHtml(): Promise<string>;
  waitForElement(selector: string): Promise<void>;
  takeScreenshot(path: string): Promise<void>;
  downloadFile(triggerAction: () => Promise<void>): Promise<Download>;
  close(): Promise<void>;
  getPage(): Page;
}

export class PlaywrightBrowserExecutor implements BrowserExecutor {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  async openUrl(url: string): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.context = await this.browser.newContext({ acceptDownloads: true });
      this.page = await this.context.newPage();
    }
    await this.page!.goto(url);
  }

  async clickElement(selector: string | Locator): Promise<void> {
    if (typeof selector === 'string') await this.page!.click(selector);
    else await selector.click();
  }

  async typeText(selector: string, text: string): Promise<void> {
    await this.page!.fill(selector, text);
  }

  async pressEnter(selector: string): Promise<void> {
    await this.page!.press(selector, 'Enter');
  }

  async waitForPageSettled(previousUrl?: string, timeoutMs = 500): Promise<void> {
    const page = this.page!;
    const urlBeforeAction = previousUrl ?? page.url();
    let navigated = page.url() !== urlBeforeAction;

    if (!navigated) {
      try {
        await page.waitForURL((url) => url.toString() !== urlBeforeAction, { timeout: timeoutMs });
        navigated = true;
      } catch {
        return;
      }
    }

    await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => undefined);
    await page.waitForLoadState('load', { timeout: timeoutMs }).catch(() => undefined);
  }

  async extractText(selector: string): Promise<string> {
    const text = await this.page!.textContent(selector);
    return text ?? '';
  }

  async getPageTitle(): Promise<string> {
    return this.page!.title();
  }

  async getCurrentUrl(): Promise<string> {
    return this.page!.url();
  }

  async getPageHtml(): Promise<string> {
    return this.page!.content();
  }

  async waitForElement(selector: string): Promise<void> {
    await this.page!.waitForSelector(selector);
  }

  async takeScreenshot(path: string): Promise<void> {
    await this.page!.screenshot({ path, fullPage: true });
  }

  async downloadFile(triggerAction: () => Promise<void>): Promise<Download> {
    const downloadPromise = this.getPage().waitForEvent('download');
    await triggerAction();
    return downloadPromise;
  }

  getPage(): Page {
    if (!this.page) throw new Error('Executor page is not initialized. Call openUrl first.');
    return this.page;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.context = undefined;
    this.browser = undefined;
    this.page = undefined;
  }
}
