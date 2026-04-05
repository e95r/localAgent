import type { ReplayMode, Scenario } from '../scenario/types.js';

export interface LibraryScenarioDefinition<TParams extends Record<string, string>> {
  name: string;
  description: string;
  params: Array<{ name: keyof TParams & string; required: boolean; description: string; defaultValue?: string }>;
  example: string;
  build: (params: TParams) => Scenario;
}

export interface BaseScenarioParams {
  startUrl: string;
  mode?: ReplayMode;
}
