import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { validateScenarioSchema } from '../scenario/schema.js';
import type { Scenario } from '../scenario/types.js';
import { buildDownloadFileScenario, type DownloadFileParams } from './builders/download-file.js';
import { buildExtractMainTextScenario, type ExtractMainTextParams } from './builders/extract-main-text.js';
import { buildOpenLatestItemScenario, type OpenLatestItemParams } from './builders/open-latest-item.js';
import { buildSearchAndOpenScenario, type SearchAndOpenParams } from './builders/search-and-open.js';
import { buildSearchWebAndOpenSiteScenario, type SearchWebAndOpenSiteParams } from './builders/search-web-and-open-site.js';

export type LibraryScenarioName = 'search-and-open' | 'search-web-and-open-site' | 'download-file' | 'extract-main-text' | 'open-latest-item';
export type LibraryParams = Record<string, string>;

export interface LibraryScenarioMetadata {
  name: LibraryScenarioName;
  description: string;
  expectedParams: string[];
  example: string;
}

const METADATA: Record<LibraryScenarioName, LibraryScenarioMetadata> = {
  'search-and-open': {
    name: 'search-and-open',
    description: 'Open a search page, type query, and submit.',
    expectedParams: ['startUrl', 'query', 'targetKeyword'],
    example: 'run-library-scenario search-and-open --param startUrl=http://127.0.0.1:3000/replay-search-page.html --param query=docs --param targetKeyword=docs',
  },
  'search-web-and-open-site': {
    name: 'search-web-and-open-site',
    description: 'Open a public search page, run query, and click the intended organic result.',
    expectedParams: ['searchUrl', 'query', 'targetKeyword', 'targetDomain'],
    example: 'run-library-scenario search-web-and-open-site --param searchUrl=http://127.0.0.1:3000/search-engine.html --param query=IANA example domains --param targetKeyword=IANA --param targetDomain=iana.org',
  },
  'download-file': {
    name: 'download-file',
    description: 'Open a page and click download link.',
    expectedParams: ['startUrl', 'targetKeyword'],
    example: 'run-library-scenario download-file --param startUrl=http://127.0.0.1:3000/replay-download-page.html --param targetKeyword=Download',
  },
  'extract-main-text': {
    name: 'extract-main-text',
    description: 'Open page and extract main article text.',
    expectedParams: ['startUrl', 'outputPath'],
    example: 'run-library-scenario extract-main-text --param startUrl=http://127.0.0.1:3000/replay-article-page.html',
  },
  'open-latest-item': {
    name: 'open-latest-item',
    description: 'Open page and click latest item link.',
    expectedParams: ['startUrl', 'targetKeyword'],
    example: 'run-library-scenario open-latest-item --param startUrl=http://127.0.0.1:3000/list-latest-item.html --param targetKeyword=latest',
  },
};

export class ScenarioLibrary {
  constructor(private readonly libraryDir: string) {}

  listAvailable(): LibraryScenarioMetadata[] {
    return Object.values(METADATA);
  }

  buildByName(name: string, params: LibraryParams): Scenario {
    switch (name as LibraryScenarioName) {
      case 'search-and-open':
        return buildSearchAndOpenScenario(params as unknown as SearchAndOpenParams);
      case 'search-web-and-open-site':
        return buildSearchWebAndOpenSiteScenario(params as unknown as SearchWebAndOpenSiteParams);
      case 'download-file':
        return buildDownloadFileScenario(params as unknown as DownloadFileParams);
      case 'extract-main-text':
        return buildExtractMainTextScenario(params as unknown as ExtractMainTextParams);
      case 'open-latest-item':
        return buildOpenLatestItemScenario(params as unknown as OpenLatestItemParams);
      default:
        throw new Error(`Unknown library scenario: ${name}`);
    }
  }

  getMetadata(name: string): LibraryScenarioMetadata {
    const meta = METADATA[name as LibraryScenarioName];
    if (!meta) throw new Error(`Unknown library scenario: ${name}`);
    return meta;
  }

  async listScenarioFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.libraryDir, { withFileTypes: true });
      return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => path.join(this.libraryDir, e.name)).sort();
    } catch {
      return [];
    }
  }

  async loadScenarioFromFile(filePath: string): Promise<Scenario> {
    const raw = await readFile(filePath, 'utf-8');
    return validateScenarioSchema(JSON.parse(raw));
  }

  async writeMetadataArtifact(filePath: string, name: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(this.getMetadata(name), null, 2), 'utf-8');
  }
}
