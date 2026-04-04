import type { Capability, CapabilityContext, CapabilityRegistry, RankedCapability } from './types.js';

export class DefaultCapabilityRegistry implements CapabilityRegistry {
  constructor(private readonly capabilities: Capability[]) {}

  rank(context: CapabilityContext): RankedCapability[] {
    const ranked = this.capabilities
      .map((capability) => {
        const match = capability.canHandle(context);
        return match ? { capability, match } : null;
      })
      .filter((item): item is RankedCapability => item !== null)
      .sort((a, b) => b.match.confidence - a.match.confidence);

    return ranked;
  }
}
