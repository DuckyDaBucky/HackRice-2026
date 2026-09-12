# Proposed architecture

This is a provider-neutral design proposal. The first implementation push determines actual frameworks, deployment boundaries and libraries.

## Components

| Component | Responsibility |
| --- | --- |
| Web client | Practice and corporate interfaces, device checks, recording, uploads, live room |
| Application API | Identity, workspace authorization, sessions, templates and signed media access |
| Relational data store | Users, memberships, profiles, sessions, rubrics, reports and audit metadata |
| Private object storage | Resumes, recordings and generated artifacts |
| Background job workers | Resume parsing, transcription, evaluation and report generation |
| AI orchestration adapter | Question generation, scoped context retrieval and evaluation |
| Voice adapter | Question speech and, if validated, live conversational audio |
| Real-time service | Proposed signaling/media transport for live sessions |
| Presage service | Exploratory SDK integration behind an isolated service boundary |

Vultr is the intended infrastructure provider; the particular services, regions and sizing are unresolved. Do not assume object storage, databases, workers or GPU capacity are provisioned.

## Recorded processing flow

`Resume upload → parse job → candidate correction → approved profile → question pack → interview session → answer uploads → transcription → rubric evaluation → report`

The API creates an upload authorization after checking session ownership. The client uploads media directly to private storage where practical. A completion event verifies the object before enqueuing work. Jobs use stable identifiers and idempotency keys so retries cannot duplicate reports or charges inadvertently.

Workers persist progress after each stage. Reports retain links to their input versions. A failed stage is retryable without rerunning successful unrelated work. Media, prompts, credentials and transcripts should not appear in routine application logs.

## Proposed session lifecycle

`draft → ready → in_progress → submitted → processing → completed`

Alternative outcomes: `cancelled`, `expired`, or `failed`, each with a reason. A transient job failure should not erase a session. Model job stage/retry status separately so “processing, transcription retrying” is representable. Submitted answers become immutable versions; corrections or re-recordings create new versions under the session policy.

## Live flow

A live-session controller coordinates question state, voice playback, candidate speech, transcript segments, and follow-up selection. Durable recording and live transcripts may arrive independently; reconcile them before final evaluation. Real-time transport is unresolved: do not assume WebRTC, a specific media server, or browser-only processing without a spike.

Keep interviewer and candidate audio identifiable. Handle reconnects, silence, overlapping speech, interruptions, and camera denial explicitly. If a live provider fails, offer a clear recorded fallback or a reschedule path; do not silently change an employer's published format.

## Reliability and operations

- Short-lived media URLs, explicit workspace checks and private buckets.
- Bounded upload sizes, interview lengths and provider timeouts.
- Job retry limits, dead-letter/manual-retry behavior and visible partial status.
- Per-session cost accounting across transcription, generation, voice and storage.
- Event tracing by opaque session/job identifiers rather than personal content.
- Health checks and structured operational errors per integration.
- Secrets server-side; use an example environment file with placeholders when code lands.

An initial monolith plus worker is a proposed low-complexity starting point. Split services only where SDK/runtime or media transport requirements justify it.
