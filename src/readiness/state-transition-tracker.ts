export interface StateTransitionEntry {
  at: string;
  type: 'start' | 'readiness' | 'banner' | 'retry' | 'action' | 'result';
  details: Record<string, unknown>;
}

export class StateTransitionTracker {
  private readonly entries: StateTransitionEntry[] = [];

  log(type: StateTransitionEntry['type'], details: Record<string, unknown>): void {
    this.entries.push({ at: new Date().toISOString(), type, details });
  }

  snapshot(): StateTransitionEntry[] {
    return [...this.entries];
  }
}
