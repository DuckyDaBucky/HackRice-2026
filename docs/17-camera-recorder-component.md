# Camera recorder component — spec

Implementation detail for [16-camera-recorder-build-slice.md](./16-camera-recorder-build-slice.md).

## Purpose

Capture a user's webcam (and mic) during a practice session, produce **one
media artifact per question**, and hand each artifact to the analysis
pipeline as soon as that question ends. **No analysis happens here** —
capture and packaging only.

## Requirements

- Show the consent/capture notice (per
  [16-camera-recorder-build-slice.md](./16-camera-recorder-build-slice.md#consent-and-trust-requirements-that-apply-to-this-slice))
  before requesting camera permission — not after.
- Request camera (and microphone) permission via `navigator.mediaDevices.getUserMedia`.
- Live `<video>` preview of the local stream, with a visible recording
  indicator whenever capture is active.
- Start / pause / resume / stop controls.
- Recording via `MediaRecorder`. Codec choice checks
  `MediaRecorder.isTypeSupported` against a preferred list and falls back
  to the browser default rather than hardcoding an unsupported codec.
- Chunked capture via `ondataavailable`, assembled into a single `Blob` on stop.
- One clip per question, many clips per session, all from the same
  `MediaStream` — open the camera once at session start, start a fresh
  `MediaRecorder` per question, don't re-request permission between
  questions.
- Submitting a finished clip to the sink must not block the UI or the next
  recording — fire it off and move on.
- Surface errors distinctly: permission denied, no camera device found,
  `MediaRecorder` unsupported, stream ended unexpectedly.
- Stop all tracks and release the camera on unmount / session end.

## States

```
idle → requesting-permission → ready (stream live, not recording)
     → recording ⇄ paused
     → stopped (clip ready, handed to sink)
     → ready (next question)
```

`error` is reachable from `requesting-permission` (denied/no device) or
from `recording`/`ready` (device lost mid-stream).

Upload/analysis status is **not** recorder state — it's tracked per clip,
since several clips can be uploading while the recorder is already
capturing the next answer.

## Design for testability

Browser media APIs (`getUserMedia`, `MediaRecorder`) don't exist in
Vitest's default `node`/`jsdom` environment in any meaningful way, so the
parts worth unit-testing are kept pure and separate from the parts that
touch those APIs:

- `mime-type.ts` — `pickRecordingMimeType(isTypeSupported)`: pure function,
  fully unit-testable.
- `recorder-state.ts` — a pure reducer (`recorderReducer(state, event)`)
  implementing the state machine above: fully unit-testable, no DOM.
- `useCameraRecorder.ts` — the hook that wires the reducer to real
  `getUserMedia`/`MediaRecorder` calls. Not unit-tested (would require
  mocking browser media APIs so heavily the test stops proving anything);
  validated by hand in the browser instead.
- `<CameraRecorder />` — thin UI wrapper around the hook. Validated by hand
  in the browser (`pnpm dev`), not via Vitest — visual/interaction
  correctness (does the preview look right, do controls feel responsive)
  isn't something a DOM-diffing test meaningfully proves.

## Interfaces

```ts
// src/lib/recording/types.ts
export interface RecordingArtifact {
  id: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: string;
}

export interface RecordingSink {
  submit(
    artifact: RecordingArtifact,
    context: { sessionId: string; questionId: string },
  ): Promise<void>;
}
```

```ts
// src/hooks/useCameraRecorder.ts
interface UseCameraRecorder {
  state: RecorderState;
  error: Error | null;
  stream: MediaStream | null;
  start: () => Promise<void>;
  record: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<RecordingArtifact>;
  release: () => void;
}
```

## Mock sink (v0)

```ts
export const inMemorySink: RecordingSink = {
  async submit(artifact, context) {
    console.log("recording ready for upload", context, artifact);
  },
};
```

## Open questions

- Upload target once a real sink exists — our API route vs. straight to
  Presage. Deferred until biometric analysis work starts.
- Video format/resolution constraints for Presage's parameters — need
  Presage's docs first; not blocking for capture-only work now.

## Browser support notes

- `getUserMedia` and `MediaRecorder` require a secure context (https or
  `localhost`).
- Safari has historically had limited/late `MediaRecorder` support —
  verify manually before relying on it for a demo.
