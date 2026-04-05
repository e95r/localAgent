import type { PostActionExpectation, RecordedTargetSnapshot, Scenario } from '../../scenario/types.js';
import { makeBaseScenario, requireParam } from './common.js';

export interface SearchWebAndOpenSiteParams {
  searchUrl: string;
  query: string;
  targetKeyword: string;
  targetDomain?: string;
}

function buildResultTarget(keyword: string, targetDomain?: string): RecordedTargetSnapshot {
  return {
    strictSelectors: [
      '#search-results .result-link',
      '#results .result-link',
      '#search-results a[href]',
      '#results a[href]',
    ],
    fallbackSelectors: ['main a[href]', 'a[href]'],
    text: keyword,
    href: targetDomain,
    tag: 'a',
    role: 'link',
    targetKeyword: keyword,
    targetDomain,
    preferOrganic: true,
  };
}

function buildResultExpectation(keyword: string, targetDomain?: string): PostActionExpectation {
  return {
    urlIncludes: targetDomain?.trim() || keyword,
  };
}

export function buildSearchWebAndOpenSiteScenario(params: SearchWebAndOpenSiteParams): Scenario {
  const searchUrl = requireParam('searchUrl', params.searchUrl);
  const query = requireParam('query', params.query);
  const keyword = requireParam('targetKeyword', params.targetKeyword);
  const targetDomain = params.targetDomain?.trim() || undefined;

  return makeBaseScenario('search-web-and-open-site', searchUrl, [
    {
      stepId: 'step-1-open-search',
      action: { actionType: 'open_url', value: searchUrl },
      pageUrlAtRecordTime: searchUrl,
    },
    {
      stepId: 'step-2-type-query',
      action: { actionType: 'type', value: query },
      pageUrlAtRecordTime: searchUrl,
      target: {
        strictSelectors: ['#search-box', 'input[name="q"]', 'input[type="search"]'],
        fallbackSelectors: ['input[placeholder*="Search"]', 'input[type="text"]'],
        text: 'Search',
        ariaLabel: 'Search',
        placeholder: 'Search',
        tag: 'input',
      },
    },
    {
      stepId: 'step-3-submit-query',
      action: { actionType: 'submit_search', mode: 'enter' },
      pageUrlAtRecordTime: searchUrl,
      target: {
        strictSelectors: ['#search-box', 'input[name="q"]', 'input[type="search"]'],
        fallbackSelectors: ['input[placeholder*="Search"]', 'input[type="text"]'],
        text: 'Search',
        ariaLabel: 'Search',
        placeholder: 'Search',
        tag: 'input',
      },
    },
    {
      stepId: 'step-4-open-result',
      action: { actionType: 'click' },
      pageUrlAtRecordTime: searchUrl,
      target: buildResultTarget(keyword, targetDomain),
      postActionExpectation: buildResultExpectation(keyword, targetDomain),
    },
    {
      stepId: 'step-5-finish',
      action: { actionType: 'finish', value: `Opened search result for ${keyword}` },
      pageUrlAtRecordTime: searchUrl,
    },
  ], 'Open a search engine, submit query, and open a relevant organic result');
}
