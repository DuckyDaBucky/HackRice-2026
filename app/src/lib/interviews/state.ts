export const V2_SESSION_STATUSES = [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "abandoned",
  "deleted",
] as const;

export type V2SessionStatus = (typeof V2_SESSION_STATUSES)[number];
export type SessionTransition = "start" | "pause" | "resume" | "complete" | "abandon" | "delete";

export interface SessionClock {
  elapsedMs: number;
  runningSinceMs: number | null;
}

export function createSessionClock(nowMs: number): SessionClock {
  return { elapsedMs: 0, runningSinceMs: nowMs };
}

export function elapsedSessionTime(clock: SessionClock, nowMs: number): number {
  return clock.elapsedMs + (clock.runningSinceMs === null ? 0 : Math.max(0, nowMs - clock.runningSinceMs));
}

/** Leaving/pausing freezes the session clock so a later resume remains fair. */
export function pauseSessionClock(clock: SessionClock, nowMs: number): SessionClock {
  if (clock.runningSinceMs === null) return clock;
  return { elapsedMs: elapsedSessionTime(clock, nowMs), runningSinceMs: null };
}

export function resumeSessionClock(clock: SessionClock, nowMs: number): SessionClock {
  if (clock.runningSinceMs !== null) return clock;
  return { ...clock, runningSinceMs: nowMs };
}

const TRANSITIONS: Record<V2SessionStatus, Partial<Record<SessionTransition, V2SessionStatus>>> = {
  planned: { start: "in_progress", delete: "deleted" },
  in_progress: { pause: "paused", complete: "completed", abandon: "abandoned", delete: "deleted" },
  paused: { resume: "in_progress", abandon: "abandoned", delete: "deleted" },
  completed: { delete: "deleted" },
  abandoned: { delete: "deleted" },
  deleted: {},
};

export function transitionSession(status: V2SessionStatus, transition: SessionTransition): V2SessionStatus {
  const next = TRANSITIONS[status][transition];
  if (!next) throw new Error(`Cannot ${transition} a ${status} interview session.`);
  return next;
}

/** Deleted sessions never issue a new private playback URL or share response. */
export function canAccessSessionArtifact(status: V2SessionStatus, deletedAt: Date | null): boolean {
  return status !== "deleted" && deletedAt === null;
}
