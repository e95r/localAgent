import type { AgentAction, Planner, PlannerInput } from '../types/actions.js';
import { DefaultCapabilityRegistry } from '../capabilities/capability-registry.js';
import { ClosePopupCapability } from '../capabilities/close-popup-capability.js';
import { DownloadCapability } from '../capabilities/download-capability.js';
import { ExtractMainContentCapability } from '../capabilities/extract-main-content-capability.js';
import { FillSearchInputCapability } from '../capabilities/fill-search-input-capability.js';
import { OpenRelevantLinkCapability } from '../capabilities/open-relevant-link-capability.js';
import { SelectListItemCapability } from '../capabilities/select-list-item-capability.js';
import { SubmitSearchCapability } from '../capabilities/submit-search-capability.js';
import type { CapabilityRegistry } from '../capabilities/types.js';

export class RuleBasedPlanner implements Planner {
  constructor(
    private readonly registry: CapabilityRegistry = new DefaultCapabilityRegistry([
      new ClosePopupCapability(),
      new DownloadCapability(),
      new FillSearchInputCapability(),
      new SubmitSearchCapability(),
      new SelectListItemCapability(),
      new OpenRelevantLinkCapability(),
      new ExtractMainContentCapability(),
    ]),
    private readonly confidenceThreshold = 0.6,
  ) {}

  decide(input: PlannerInput): AgentAction {
    const ranked = this.registry.rank(input);
    if (!ranked.length) {
      return {
        type: 'ask_user',
        question: 'Недостаточно сигналов для действия. Уточните цель.',
        confidence: 0.1,
        reason: 'No matching capability',
        plannerSource: 'rule-based',
      };
    }

    const [best, runnerUp] = ranked;
    if (best.match.confidence < this.confidenceThreshold || (runnerUp && runnerUp.match.confidence >= best.match.confidence - 0.01)) {
      return {
        type: 'ask_user',
        question: 'Нашлось несколько вариантов действия. Уточните, что сделать.',
        confidence: best.match.confidence,
        reason: best.match.reason,
        candidateTargets: best.match.candidateTargets,
        selectedCapabilityName: best.capability.name,
        plannerSource: 'rule-based',
      };
    }

    const planned = best.capability.plan(input, best.match);
    return {
      ...planned,
      confidence: best.match.confidence,
      reason: best.match.reason,
      candidateTargets: best.match.candidateTargets,
      selectedCapabilityName: best.capability.name,
      plannerSource: 'rule-based',
    };
  }
}
