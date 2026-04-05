import type { Scenario } from '../../scenario/types.js';
import { makeBaseScenario, requireParam } from './common.js';

export interface OpenLatestItemParams {
  startUrl: string;
  targetKeyword: string;
}

export function buildOpenLatestItemScenario(params: OpenLatestItemParams): Scenario {
  const startUrl = requireParam('startUrl', params.startUrl);
  const keyword = requireParam('targetKeyword', params.targetKeyword);

  return makeBaseScenario('open-latest-item', startUrl, [
    { stepId: 'step-1-open', action: { actionType: 'open_url', value: startUrl }, pageUrlAtRecordTime: startUrl },
    {
      stepId: 'step-2-open-latest',
      action: { actionType: 'click' },
      pageUrlAtRecordTime: startUrl,
      target: { strictSelectors: ['a[href*="2026-04"]'], fallbackSelectors: ['a:last-of-type'], text: keyword, ariaLabel: keyword },
      postActionExpectation: { urlIncludes: '/item-2026-04' },
    },
    { stepId: 'step-3-finish', action: { actionType: 'finish', value: 'Opened latest item' }, pageUrlAtRecordTime: startUrl },
  ], 'Open latest list item by keyword and recency hint');
}
