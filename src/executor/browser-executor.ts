import { chromium, type Browser, type BrowserContext, type Locator, type Page, type Download } from 'playwright';

export interface BrowserExecutor {
  openUrl(url: string): Promise<void>;
  clickElement(selector: string | Locator): Promise<void>;
  typeText(selector: string, text: string): Promise<void>;
  extractText(selector: string): Promise<string>;
  getPageTitle(): Promise<string>;
  getCurrentUrl(): Promise<string>;
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
    if (typeof selector === 'string') {
      await this.page!.click(selector);
      return;
    }
    await selector.click();
  }

  async typeText(selector: string, text: string): Promise<void> {
    await this.page!.fill(selector, text);
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

  async waitForElement(selector: string): Promise<void> {
    await this.page!.waitForSelector(selector);
  }

  async takeScreenshot(path: string): Promise<void> {
    await this.page!.screenshot({ path, fullPage: true });
  }

  async downloadFile(triggerAction: () => Promise<void>): Promise<Download> {
    const page = this.getPage();
    const downloadPromise = page.waitForEvent('download');
    await triggerAction();
    return downloadPromise;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Executor page is not initialized. Call openUrl first.');
    }
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
