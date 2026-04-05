import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScenarioLibrary } from '../../src/library/scenario-library.js';
import { buildSearchAndOpenScenario } from '../../src/library/builders/search-and-open.js';
import { buildSearchWebAndOpenSiteScenario } from '../../src/library/builders/search-web-and-open-site.js';

describe('library scenarios', () => {
  it('builder returns valid scenario object', () => {
    const scenario = buildSearchAndOpenScenario({ startUrl: 'http://x', query: 'docs', targetKeyword: 'docs' });
    expect(scenario.name).toBe('search-and-open');
    expect(scenario.steps.length).toBeGreaterThan(2);
  });


  it('search-web-and-open-site builder includes organic hint and domain expectation', () => {
    const scenario = buildSearchWebAndOpenSiteScenario({
      searchUrl: 'http://x/search',
      query: 'IANA example domains',
      targetKeyword: 'IANA',
      targetDomain: 'iana.org',
    });
    expect(scenario.name).toBe('search-web-and-open-site');
    const openResult = scenario.steps.find((step) => step.stepId === 'step-4-open-result');
    expect(openResult?.target?.preferOrganic).toBe(true);
    expect(openResult?.postActionExpectation?.urlIncludes).toBe('iana.org');
  });

  it('missing required params are rejected', () => {
    expect(() => buildSearchAndOpenScenario({ startUrl: '', query: 'docs', targetKeyword: 'docs' })).toThrow(/Missing required param: startUrl/);
  });

  it('discovers scenario files from library directory', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'lib-scenarios-'));
    try {
      await writeFile(path.join(dir, 'one.json'), '{}', 'utf-8');
      await writeFile(path.join(dir, 'two.txt'), 'x', 'utf-8');
      const files = await new ScenarioLibrary(dir).listScenarioFiles();
      expect(files.some((f) => f.endsWith('one.json'))).toBe(true);
      expect(files.some((f) => f.endsWith('two.txt'))).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
