import { describe, expect, it } from 'vitest';
import { defaultLlmPlannerConfig, withPlannerConfig } from '../../src/planner/planner-config.js';

describe('planner config', () => {
  it('has sane defaults and override support', () => {
    expect(defaultLlmPlannerConfig.enableLlmFallback).toBe(true);
    expect(withPlannerConfig({ enableLlmFallback: false }).enableLlmFallback).toBe(false);
  });
});
