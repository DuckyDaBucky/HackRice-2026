export type RecorderState =
  | "idle"
  | "requesting-permission"
  | "ready"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export type RecorderEvent =
  | { type: "REQUEST_PERMISSION" }
  | { type: "PERMISSION_GRANTED" }
  | { type: "PERMISSION_DENIED" }
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "STOP" }
  | { type: "RESET_FOR_NEXT_QUESTION" }
  | { type: "DEVICE_ERROR" };

const TRANSITIONS: Partial<Record<RecorderState, Partial<Record<RecorderEvent["type"], RecorderState>>>> = {
  idle: {
    REQUEST_PERMISSION: "requesting-permission",
  },
  "requesting-permission": {
    PERMISSION_GRANTED: "ready",
    PERMISSION_DENIED: "error",
  },
  ready: {
    START: "recording",
    DEVICE_ERROR: "error",
  },
  recording: {
    PAUSE: "paused",
    STOP: "stopped",
    DEVICE_ERROR: "error",
  },
  paused: {
    RESUME: "recording",
    STOP: "stopped",
    DEVICE_ERROR: "error",
  },
  stopped: {
    RESET_FOR_NEXT_QUESTION: "ready",
  },
  error: {
    REQUEST_PERMISSION: "requesting-permission",
  },
};

/** Unknown events for the current state are ignored — the caller sees no state change. */
export function recorderReducer(
  state: RecorderState,
  event: RecorderEvent,
): RecorderState {
  return TRANSITIONS[state]?.[event.type] ?? state;
}
