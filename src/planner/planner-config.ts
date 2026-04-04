export interface LlmPlannerConfig {
  enableLlmFallback: boolean;
  ruleConfidenceThreshold: number;
  llmConfidenceThreshold: number;
  saveLlmArtifacts: boolean;
  maxPlannerRetries: number;
}

export const defaultLlmPlannerConfig: LlmPlannerConfig = {
  enableLlmFallback: true,
  ruleConfidenceThreshold: 0.65,
  llmConfidenceThreshold: 0.6,
  saveLlmArtifacts: true,
  maxPlannerRetries: 1,
};

export function withPlannerConfig(overrides: Partial<LlmPlannerConfig> = {}): LlmPlannerConfig {
  return { ...defaultLlmPlannerConfig, ...overrides };
}
