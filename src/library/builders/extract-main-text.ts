import type { Scenario } from '../../scenario/types.js';
import { makeBaseScenario, requireParam } from './common.js';

export interface ExtractMainTextParams {
  startUrl: string;
  outputPath?: string;
}

export function buildExtractMainTextScenario(params: ExtractMainTextParams): Scenario {
  const startUrl = requireParam('startUrl', params.startUrl);

  return makeBaseScenario('extract-main-text', startUrl, [
    { stepId: 'step-1-open', action: { actionType: 'open_url', value: startUrl }, pageUrlAtRecordTime: startUrl },
    {
      stepId: 'step-2-extract',
      action: { actionType: 'extract_text' },
      pageUrlAtRecordTime: startUrl,
      target: { strictSelectors: ['#article-main'], fallbackSelectors: ['article, main'], text: 'Article', ariaLabel: 'Article' },
      postActionExpectation: { extractedNonEmpty: true },
    },
    { stepId: 'step-3-finish', action: { actionType: 'finish', value: `Extracted text${params.outputPath ? ` to ${params.outputPath}` : ''}` }, pageUrlAtRecordTime: startUrl },
  ], 'Extract main content text from article-like container');
}
