import type { Scenario } from '../../scenario/types.js';
import { makeBaseScenario, requireParam } from './common.js';

export interface DownloadFileParams {
  startUrl: string;
  targetKeyword: string;
}

export function buildDownloadFileScenario(params: DownloadFileParams): Scenario {
  const startUrl = requireParam('startUrl', params.startUrl);
  const keyword = params.targetKeyword?.trim() || 'Download';

  return makeBaseScenario('download-file', startUrl, [
    { stepId: 'step-1-open', action: { actionType: 'open_url', value: startUrl }, pageUrlAtRecordTime: startUrl },
    {
      stepId: 'step-2-download',
      action: { actionType: 'click' },
      pageUrlAtRecordTime: startUrl,
      target: { strictSelectors: ['#download-link'], fallbackSelectors: ['a[download]'], text: keyword, ariaLabel: keyword },
      postActionExpectation: { fileDownloadExpected: true },
    },
    { stepId: 'step-3-finish', action: { actionType: 'finish', value: 'File download triggered' }, pageUrlAtRecordTime: startUrl },
  ], 'Open page and trigger download link');
}
