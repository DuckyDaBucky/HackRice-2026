# Build slice: interview practice foundation + camera recorder

## Status

Adopts "Get Me Hired" as the product name and the milestone sequence in
[11-hackrice-delivery-plan.md](./11-hackrice-delivery-plan.md) as source of
truth. This doc records the concrete decisions for the **first code slice**
being implemented now, reconciled against that plan and against
[02-practice-experience.md](./02-practice-experience.md),
[07-data-and-api-design.md](./07-data-and-api-design.md), and
[09-trust-and-camera-features.md](./09-trust-and-camera-features.md).

Supersedes the narrower `interview-tool-spec.md` /
`camera-recording-spec.md` drafts written before this reconciliation
(preserved at author's discretion outside `docs/` — not part of this
history).

## Where this slice sits in the delivery plan

Milestone 1 ("Interview foundation") and Milestone 2 ("Recorded practice")
both require a working camera/recording capture path before anything else
in either milestone is testable. This slice builds that path plus the
minimum session/question flow needed to exercise it — it does **not**
complete either milestone on its own (no identity/workspace isolation
beyond what Clerk already gives us, no transcription, no evaluation).

## Personalization: static question bank first

[02-practice-experience.md](./02-practice-experience.md) already documents
a fallback: *"A candidate may omit a resume and enter a short structured
profile... This should produce more general questions."* This slice takes
that fallback as the **starting** path, not a deviation from the plan:
resume upload/parsing is real work belonging to its own slice and isn't a
prerequisite for getting recording and session flow working.

- Two modes: **Technical** and **Behavioral** (both are "technical-behavioral"
  in the product brief's sense — no live-coding judge).
- Questions come from a static, hardcoded pack per mode for now
  (`QuestionSource` interface, swappable later for Gemini-generated packs
  per [08-ai-and-context.md](./08-ai-and-context.md)).

## Analysis pipeline: per-answer, not real-time, not end-of-session

Decision carried over from earlier planning, restated in this repo's entity
names: each `AnswerAttempt` is submitted to analysis as soon as its
recording stops, independent of other answers in the session —
not streamed live during recording, and not batched until the whole
session ends.

- **Not real-time:** streaming frames to an analyzer mid-answer needs
  low-latency inference plus WebSocket/WebRTC transport — a materially
  harder problem, and out of scope for this slice. Matches
  [05-architecture.md](./05-architecture.md)'s note that live transport is
  unresolved and needs its own spike (Milestone 5).
- **Not end-of-session:** per-answer analysis gives feedback that maps to
  one question, results arrive sooner, and one failed job doesn't block the
  rest of the session.
- No real analyzer is wired up in this slice — `EvaluationVersion` /
  `Observation` creation is stubbed. See "Explicitly out of scope" below.

## Consent and trust requirements that apply to this slice

[09-trust-and-camera-features.md](./09-trust-and-camera-features.md) is
binding on any code that opens a camera, so this slice must, before
`getUserMedia` is called:

- Show what will be captured, why, and that no Presage/biometric signal is
  collected yet (only video for later human/AI review of the answer).
- Show an active-recording indicator whenever the camera is capturing.
- Make clear that stopping/ending the session stops all capture.

A `ConsentRecord` is not being persisted yet (no DB writes in this slice),
but the UI copy must not promise privacy behavior the code doesn't
implement, and must not silently start capturing before the user
acknowledges the notice.

## Explicitly out of scope for this slice

- Resume upload/parsing and personalization
- Presage biometric/facial analysis, and any `Observation` records
- ElevenLabs voice (questions are shown as text for now)
- Transcription and evaluation (`TranscriptVersion`, `EvaluationVersion`)
- Corporate/HR workflows, requisitions, invitations
- Live practice, meeting-bot integrations
- Persisting sessions to TigerData — this slice can run against in-memory
  state; schema/migrations are a separate, parallel-track piece of work
  (see below)

## What's being built now

1. **Camera recording capture** — one recorded clip per question, built as
   a reusable hook + component. Detailed spec:
   [camera-recorder-component.md](./17-camera-recorder-component.md).
2. **Interview practice flow (client-only)** — mode select → consent/device
   check → per-question recording → review, wired to the static question
   bank and a mock analysis sink.

## Parallel track

Database schema for `InterviewSession` / `Question` / `AnswerAttempt` per
[07-data-and-api-design.md](./07-data-and-api-design.md), scoped to just
what this slice's flow needs, is being drafted independently (see
[18-data-model-slice.md](./18-data-model-slice.md) once available) so the
client-side recorder work isn't blocked on schema decisions, and vice
versa. The two integrate once both land: the client flow currently holds
state in memory and doesn't call the DB.
