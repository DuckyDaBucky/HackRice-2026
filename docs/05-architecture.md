# Proposed architecture

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Current implementation

The repository contains the Next.js app plus a separate native `presage-api` service. API handlers, Drizzle/SQL schema assets, R2 signing/upload support, LangChain/Gemini, Backboard and ElevenLabs paths are present. The tables below describe the broader target architecture, not a claim that workers, corporate workflows or end-to-end report playback are finished. See [current codebase](14-current-codebase.md).

## Components

| Component | Responsibility |
| --- | --- |
| Web client | Practice and corporate interfaces, device checks, recording, uploads and report playback |
| Application API | Identity, workspace authorization, sessions, templates and signed media access |
| Relational data store | Users, memberships, profiles, sessions, rubrics, reports and audit metadata |
| Private object storage | Resumes, recordings and generated artifacts |
| Background job workers | Resume parsing, transcription, evaluation and report generation |
| AI orchestration adapter | Question generation, scoped context retrieval and evaluation |
| Voice adapter | Question speech playback; independent question text |
| Report processing | Analysis after submission; reports with timestamped playback |
| Presage service | Exploratory SDK integration behind an isolated service boundary |

Vultr is the intended infrastructure provider; the particular services, regions and sizing are unresolved. Do not assume object storage, databases, workers or GPU capacity are provisioned.

## Recorded processing flow

`Resume upload → parse job → candidate correction → approved profile → question pack → interview session → answer uploads → transcription → rubric evaluation → report`

The API creates an upload authorization after checking session ownership. The client uploads media directly to private storage where practical. A completion event verifies the object before enqueuing work. Jobs use stable identifiers and idempotency keys so retries cannot duplicate reports or charges inadvertently.

Workers persist progress after each stage. Reports retain links to their input versions. A failed stage is retryable without rerunning successful unrelated work. Media, prompts, credentials and transcripts should not appear in routine application logs.

## Proposed session lifecycle

`draft → ready → in_progress → submitted → processing → completed`

Alternative outcomes: `cancelled`, `expired`, or `failed`, each with a reason. A transient job failure should not erase a session. Model job stage/retry status separately so “processing, transcription retrying” is representable. Submitted answers become immutable versions; corrections or re-recordings create new versions under the session policy.

## Post-interview analysis and HR guidance

Run transcription and evaluation after answer submission. Publish a report only when its evidence and media alignment are ready; expose failures and incomplete stages explicitly. Link findings to playback timestamps without inventing alignment. Keep any future Presage output within this post-processing boundary and validate SDK support before promising recording analysis.

An HR-only overlay may show an approved answer guide for the selected question. This is static or precomputed interviewer assistance, not live candidate analysis. It must not display evolving candidate scores, physiological judgments or cheating conclusions.

## Reliability and operations

- Short-lived media URLs, explicit workspace checks and private buckets.
- Bounded upload sizes, interview lengths and provider timeouts.
- Job retry limits, dead-letter/manual-retry behavior and visible partial status.
- Per-session cost accounting across transcription, generation, voice and storage.
- Event tracing by opaque session/job identifiers rather than personal content.
- Health checks and structured operational errors per integration.
- Secrets server-side; use an example environment file with placeholders when code lands.

An initial monolith plus worker is a proposed low-complexity starting point. Split services only where SDK/runtime or media transport requirements justify it.
