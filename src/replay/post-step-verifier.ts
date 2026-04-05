import type { BrowserExecutor } from '../executor/browser-executor.js';
import type { PostActionExpectation } from '../scenario/types.js';

export interface ExpectedCheck {
  passed: boolean;
  reason: string;
}

export async function verifyPostStepExpectation(
  executor: BrowserExecutor,
  expectation: PostActionExpectation | undefined,
  extractedText?: string,
  downloadsCount = 0,
): Promise<ExpectedCheck> {
  if (!expectation) return { passed: true, reason: 'No expectation provided' };

  if (expectation.urlIncludes) {
    const url = await executor.getCurrentUrl();
    if (!url.includes(expectation.urlIncludes)) return { passed: false, reason: `URL mismatch: expected includes '${expectation.urlIncludes}', actual '${url}'` };
  }

  if (expectation.titleIncludes) {
    const title = await executor.getPageTitle();
    if (!title.includes(expectation.titleIncludes)) return { passed: false, reason: `Title mismatch: expected includes '${expectation.titleIncludes}', actual '${title}'` };
  }

  if (expectation.textVisible) {
    const html = await executor.getPageHtml();
    if (!html.includes(expectation.textVisible)) return { passed: false, reason: `Expected text not visible: '${expectation.textVisible}'` };
  }

  if (expectation.elementDisappearedSelector) {
    const html = await executor.getPageHtml();
    if (html.includes(expectation.elementDisappearedSelector.replace('#', 'id="'))) {
      return { passed: false, reason: `Element still present: '${expectation.elementDisappearedSelector}'` };
    }
  }

  if (expectation.extractedNonEmpty && !(extractedText ?? '').trim()) {
    return { passed: false, reason: 'Expected non-empty extracted text' };
  }

  if (expectation.fileDownloadExpected && downloadsCount === 0) {
    return { passed: false, reason: 'Expected file download did not start' };
  }

  return { passed: true, reason: 'Expectation satisfied' };
}
