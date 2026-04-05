export const SCENARIO_SCHEMA_VERSION = '1.0.0';

export type ScenarioActionType = 'click' | 'type' | 'submit_search' | 'extract_text' | 'wait_for' | 'open_url' | 'finish';
export type ReplayMode = 'strict' | 'adaptive';

export interface ScenarioMetadata {
  sourceUrl: string;
  startUrl: string;
  description?: string;
  tags?: string[];
}

export interface RecordedTargetSnapshot {
  targetId?: string;
  selectorHint?: string;
  strictSelectors: string[];
  fallbackSelectors: string[];
  tag?: string;
  role?: string | null;
  text?: string;
  ariaLabel?: string | null;
  href?: string | null;
  placeholder?: string | null;
  nearestTextContext?: string;
  containerHint?: string | null;
  domSnippet?: string;
  visible?: boolean;
  enabled?: boolean;
  clickable?: boolean;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  screenshotRef?: string;
  domSnippetRef?: string;
}

export interface PostActionExpectation {
  urlIncludes?: string;
  textVisible?: string;
  elementDisappearedSelector?: string;
  fileDownloadExpected?: boolean;
  extractedNonEmpty?: boolean;
  searchResultsChanged?: boolean;
  titleIncludes?: string;
}

export interface RecordedAction {
  actionType: ScenarioActionType;
  value?: string;
  mode?: 'button' | 'enter';
}

export interface ScenarioStep {
  stepId: string;
  action: RecordedAction;
  pageUrlAtRecordTime: string;
  target?: RecordedTargetSnapshot;
  semanticIntent?: string;
  expectedOutcome?: string;
  postActionExpectation?: PostActionExpectation;
}

export interface Scenario {
  schemaVersion: string;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: ScenarioMetadata;
  steps: ScenarioStep[];
}

export type ResolutionStrategy = 'strict-selector' | 'fallback-selector' | 'semantic-match' | 'planner-assisted' | 'ask-user';

export interface ReplayStepResult {
  approvalOutcome?: 'not-required' | 'approved' | 'rejected';
  plannerSource?: string;
  stepId: string;
  actionType: ScenarioActionType;
  success: boolean;
  strategy: ResolutionStrategy;
  confidence: number;
  reason: string;
  askUserQuestion?: string;
  extractedText?: string;
  error?: string;
  expectedCheck?: { passed: boolean; reason: string };
}

export interface ReplayResult {
  mode: ReplayMode;
  success: boolean;
  finishedAt: string;
  steps: ReplayStepResult[];
}
