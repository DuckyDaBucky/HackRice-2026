export interface SessionLease {
  readonly id: string;
  setCleanup(cleanup: () => Promise<void>): void;
  release(): void;
}

interface ActiveSession {
  id: string;
  cleanup?: () => Promise<void>;
}

export class SessionCoordinator {
  private active: ActiveSession | null = null;

  get activeSessionId(): string | null {
    return this.active?.id ?? null;
  }

  tryAcquire(id: string): SessionLease | null {
    if (this.active) return null;

    const active: ActiveSession = { id };
    this.active = active;
    let released = false;

    return {
      id,
      setCleanup: (cleanup) => {
        active.cleanup = cleanup;
      },
      release: () => {
        if (released) return;
        released = true;
        if (this.active === active) this.active = null;
      },
    };
  }

  async shutdown(): Promise<void> {
    const active = this.active;
    if (!active?.cleanup) return;
    await active.cleanup();
  }
}
