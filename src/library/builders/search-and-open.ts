import type { Scenario } from '../../scenario/types.js';
import { makeBaseScenario, requireParam } from './common.js';

export interface SearchAndOpenParams {
  startUrl: string;
  query: string;
  targetKeyword: string;
}

export function buildSearchAndOpenScenario(params: SearchAndOpenParams): Scenario {
  const startUrl = requireParam('startUrl', params.startUrl);
  const query = requireParam('query', params.query);
  const keyword = requireParam('targetKeyword', params.targetKeyword);

  return makeBaseScenario('search-and-open', startUrl, [
    {
      stepId: 'step-1-open',
      action: { actionType: 'open_url', value: startUrl },
      pageUrlAtRecordTime: startUrl,
    },
    {
      stepId: 'step-2-type',
      action: { actionType: 'type', value: query },
      pageUrlAtRecordTime: startUrl,
      target: { strictSelectors: ['#search-box'], fallbackSelectors: ['input[placeholder*="Find"]'], text: 'Find article', ariaLabel: 'Find article' },
    },
    {
      stepId: 'step-3-submit',
      action: { actionType: 'submit_search', mode: 'button' },
      pageUrlAtRecordTime: startUrl,
      target: { strictSelectors: ['#submit-search'], fallbackSelectors: ['button'], text: 'Search', ariaLabel: 'Search' },
    },
    {
      stepId: 'step-4-finish',
      action: { actionType: 'finish', value: `Opened result containing ${keyword}` },
      pageUrlAtRecordTime: startUrl,
    },
  ], 'Search query and open relevant result');
}
