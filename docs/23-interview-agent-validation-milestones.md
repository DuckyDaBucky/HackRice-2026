# Interview agent: validation-first milestones

**Status:** working plan

**Companion:** [Interview agent and dashboard implementation brief](./22-interview-agent-and-dashboard-implementation.md)

This plan deliberately treats every milestone as a product and engineering
claim that must be proven. A milestone is not complete because code exists; it
is complete when its exit criteria, test evidence, and demo behavior are
recorded. We should review the evidence together at each gate before beginning
the next milestone.

## How we will use this document

For every milestone we will maintain four fields:

| Field | Meaning |
| --- | --- |
| **Decision record** | The product choices made and who approved them |
| **Implementation evidence** | PR/commit, migration, endpoint, UI route and configuration changed |
| **Validation evidence** | Automated test output, manual test notes, screenshots/recording and known limitations |
| **Gate result** | `pass`, `pass with stated risk`, or `rework` |

### Global rules

1. Do not proceed past a gate by replacing an unresolved requirement with a
   vague TODO. Narrow scope explicitly instead.
2. Never make recording/transcript accessibility, privacy or user ownership
   worse in the name of demo speed.
3. Test model behavior as a versioned contract: scenario corpus + expected
   permitted action, not “the output looked good once.”
4. Any third-party model, TTS or transcription outage must have a candidate-safe
   continuation path before it is considered demo-ready.
5. Keep practice feedback separate from employment decisions. No protected or
   biometric inferences belong in the product or evaluation pipeline.

## Milestone overview

| # | Milestone | Core claim we must prove | Depends on | Exit artifact |
| --- | --- | --- | --- | --- |
| M0 | Product contract | We know what we are building and for whom | — | Approved decision sheet + demo script |
| M1 | Session integrity | A session can survive real user behavior without data mismatch | M0 | Persisted plan and resumable turn timeline |
| M2 | Candidate-controlled interview | Users can reliably complete an answer without silence auto-ending them | M1 | Functional interview controls and recovery states |
| M3 | Bounded interviewer agent | The AI chooses only permitted next turns and degrades safely | M1, M2 | Validated orchestrator + scenario corpus |
| M4 | Trustworthy report | Feedback is evidence-linked, useful and honest about limits | M1, M3 | Report page + rubric/evaluation pipeline |
| M5 | Purposeful dashboard | Home reliably directs users to practice, resume or feedback | M4 | Dashboard history/empty/resume/report states |
| M6 | Demo and release hardening | The end-to-end experience works under expected failure conditions | M0–M5 | Runbook, evidence pack and rehearsed demo |

---

## M0 — Product contract and demo definition

### Claim

We have one sharply defined MVP experience that a teammate can explain,
build, test and demo consistently.

### Scope

- Choose the initial audience, role family, interview format, session length
  and success outcome.
- Define the practice/corporate boundary; corporate can be explicitly deferred.
- Select the interviewer's allowed capabilities, conversation limits and tone.
- Approve the feedback rubric's first competencies and the reporting promise.
- Choose all required providers or named temporary fallbacks.
- Write the happy-path demo as a scripted, two-minute candidate journey.

### Decisions required

| ID | Decision | Required answer |
| --- | --- | --- |
| M0-D1 | Primary user | Specific initial persona, e.g. CS new graduate preparing for behavioral interviews |
| M0-D2 | Interview type | Behavioral, technical-behavioral, system design, coding, or an explicitly bounded subset |
| M0-D3 | Personalization | Inputs allowed at MVP: target role, job description, resume, prior reports, etc. |
| M0-D4 | Candidate agency | Which controls exist: finish, pause, repeat, rephrase, skip, restart, end |
| M0-D5 | Agent policy | Maximum planned questions, probes/question, clarification behavior and total time cap |
| M0-D6 | Feedback promise | Exact candidate-facing outputs and whether numeric scoring is shown |
| M0-D7 | Consent/retention | Camera requirement, recording/transcript retention and deletion expectation |
| M0-D8 | Demo constraints | Date, device/browser, network assumptions, credentials and acceptable simulation/fallback |

### Implementation tasks

- Turn all M0 decisions into a one-page product contract appended below.
- Translate the demo journey into visible UI states and backend state
  transitions.
- Create a simple feature flag matrix: `practiceAgent`, `liveCaptions`,
  `ttsProvider`, `reportGeneration`, `corporateMode`.
- Document provider ownership, budget/limits and an outage fallback per
  dependency.

### Validation

- A non-builder can read the product contract and correctly describe who the
  product serves, what happens in one session, and what feedback they receive.
- The team can run the demo script without inventing a behavior not in scope.
- Each external dependency has an owner and an explicit fallback.
- No selected feature conflicts with the privacy/non-negotiables in the
  implementation brief.

### Gate evidence

- Completed M0 decision table.
- Approved two-minute demo script.
- Named owner/date for each unresolved item.

### Gate result

`Pass with stated risk` — see the accepted M0 demo contract and current runtime
validation notes below.

---

## M1 — Reliable session foundation

### Claim

Every interview has a durable plan and event history. Refreshing, resuming,
retrying an upload or recovering from a transient failure cannot silently swap
questions, duplicate answers or lose candidate-owned data.

### Scope

- Persist the complete question plan before interview lobby entry.
- Persist validated interview state transitions and turn events.
- Make question/answer/media artifacts independently addressable.
- Build authenticated resume and retry behavior.
- Preserve existing practice flow while replacing static-resume inconsistency.

### Non-goals

- Full agent behavior and scoring.
- A realtime transport provider.
- Corporate permissions beyond correct per-user ownership.

### Implementation tasks

1. Add migrations for `interview_question_plans`, `interview_turns`,
   `media_artifacts` and the minimal session fields described in the brief.
2. Create server-side types/schemas for every status and event. Status changes
   are not inferred from UI text or raw model output.
3. On session creation, generate or select the complete question plan; save the
   exact wording, order, rubric intent and configuration version.
4. Replace current resume logic with `GET session state`, returning the saved
   plan, completed/current turn and upload statuses.
5. Make media submission idempotent using a client generated artifact ID and
   server-side checksum/key verification.
6. Add explicit `uploading`, `uploaded`, `retryable_failed` and
   `terminal_failed` candidate-visible states.
7. Enforce session ownership in every route/action; never trust a session ID
   from the browser by itself.
8. Create a safe session-detail read model even if the first UI only uses it
   for resume.

### Validation cases

| Scenario | Expected result |
| --- | --- |
| Refresh while interviewer is speaking | Session returns to same plan question; no second question event is created |
| Refresh while recording | UI explains whether recording can be recovered; it never claims a missing clip uploaded |
| Network fails during upload | Candidate sees retry state; retry creates one artifact, not duplicates |
| Resume after question 2 of 3 | Original question 3 and configuration appear, not a regenerated/static substitute |
| Resume completed session | Open report/detail, never re-enter recording flow |
| User A requests User B session | 404/authorization-safe result; no content or metadata leaks |
| Generator times out before lobby | Fallback plan is persisted and visibly identified in telemetry, not an empty interview |

### Automated evidence

- Unit tests: session transition reducer; schemas; plan serialization;
  idempotency; artifact status mapping.
- Integration tests: authenticated creation/resume/finalize routes; database
  ownership; retry request sequence.
- At least one browser test: complete question, reload, resume and finish.

### Manual evidence

- Short screen recording of a create → answer → refresh → resume path.
- Database/console evidence that there is exactly one saved plan and one answer
  artifact per finalized turn.

### Gate criteria

- All validation cases pass or have a documented product-level limitation.
- No `in_progress` session is displayed with an unknown/incorrect current
  question.
- A failed upload has a truthful user state and an owner-facing trace.

### Gate result

`Pass with stated risk` — v2 schema migrations are applied to the development database;
durable setup/plan/turn/artifact/transcript services, authenticated plan route,
persisted session page and new setup experience are implemented. The original
plan, paused clock, skip state and pending follow-up state now resume from their
durable records. Remaining M1 work: browser walkthrough and retry UI.

### M1 implementation evidence — Sep 12, 2026

- Added and applied `app/migrations/0005_durable_interview_sessions.sql` to the
  development Postgres database. It is additive and leaves legacy session data
  intact.
- Added and applied `app/migrations/0006_session_clock.sql`; active elapsed
  time is now retained across pause, leave, resume and completion rather than
  using wall-clock time.
- Added typed v2 schema/contracts, transactional persistence, complete-plan
  generation, R2 artifact verification, transcript records and soft-delete
  access denial.
- Added `POST /api/interviews`, `/interview/session/[sessionId]` and a setup
  surface for selected tracks, 10/20/30-minute duration, target role, level,
  focus, voice and tone.
- Added focused contract/planner/route/artifact tests. At this checkpoint,
  `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test --run` (109 tests) and
  `pnpm build` pass.
- A synthetic live Gemini plan check returned `429` on the configured free-tier
  key. The plan API now persists a selected-track static fallback instead of
  stranding the candidate, with the provider error retained in the generation
  record.

---

### M1 implementation contract for the current codebase

The current `interview_sessions` / `questions` / `answer_attempts` schema is a
valid static-question prototype, but it cannot model an adaptive, mixed
interview. M1 uses an **additive v2 schema**. We do not delete existing tables
or historical clips: legacy static sessions remain readable, while every new
session uses the v2 plan/turn/artifact records below.

| Record | Why it exists | Minimum fields |
| --- | --- | --- |
| `interview_session_configs` | Immutable configuration revisions; required because focus can change mid-session | `id`, `session_id`, `revision`, `content_types`, `target_role`, `seniority`, `focus_area`, `time_budget_seconds`, `voice_id`, `mood`, `created_at` |
| `interview_plan_questions` | Persisted internal question plan, independent of the static bank | `id`, `session_id`, `config_revision`, `position`, `content_type`, `prompt`, `intent`, `max_follow_ups`, `status`, `asked_at`, `superseded_at` |
| `interview_turns` | Ordered, append-only interview history; supports revisit, repeat, skip and probe | `id`, `session_id`, `plan_question_id`, `sequence`, `kind`, `parent_turn_id`, `text`, `status`, `created_at` |
| `media_artifacts` | Separates an actual recorded file from a question, allowing retries/revisits | `id`, `session_id`, `turn_id`, `r2_key`, `mime_type`, `duration_ms`, `checksum`, `upload_status`, `created_at` |
| `audio_transcripts` | Durable speech-to-text record for an answer artifact; source for report and playback evidence | `id`, `artifact_id`, `turn_id`, `provider`, `language`, `status`, `full_text`, `segments_json`, `started_at`, `completed_at`, `created_at` |
| `ai_generations` | Persists every planner/agent generation before and after the model call | `id`, `session_id`, `turn_id`, `purpose`, `status`, `model`, `prompt_version`, `input_hash`, `result`, `usage_json`, `estimated_cost_cents`, `created_at` |
| `interview_events` | Idempotent state/audit trail for client and system actions | `id`, `session_id`, `sequence`, `event_type`, `payload_json`, `occurred_at` |
| `report_share_links` | Future report-only sharing without exposing media | `id`, `session_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at` |

`interview_sessions` gains `started_at`, `paused_at`, `deleted_at`,
`deleted_by_user_id`, `active_config_revision` and a v2 lifecycle status. The
v2 lifecycle is `planned → in_progress ↔ paused → completed`, with `deleted`
as an access state. “Leave interview” becomes `paused`, not the current
`abandoned`, so it is resumable by default. `abandoned` remains a legacy status
until migration/backfill is complete.

#### Plan and configuration rules

1. A session/configuration record and an `ai_generations` row with `purpose =
   'plan'` are created **before** the planner model is called. This gives an
   interrupted generation a durable ID and failure state rather than silently
   losing it on refresh.
2. The planner persists an internal numbered target plan before lobby entry.
   It records each question's selected content type and intended evidence.
3. A focus-area edit creates configuration revision `n + 1`. Completed/current
   questions remain immutable; only unasked plan questions may be superseded
   and replaced under the new revision.
4. A repeat/rephrase is a new interviewer turn linked to the original question.
   An agent-initiated revisit is a new question turn linked to the original
   plan question. Neither overwrites history.
5. A skip is an immutable candidate turn plus `plan_question.status =
   'skipped'`; reports describe it as skipped rather than a weak answer.
6. Each finalized candidate audio/video artifact receives an `audio_transcripts`
   record. Live browser captions may be saved immediately as a `client_draft`,
   but final report/replay evidence uses a persisted timestamped transcript from
   the uploaded artifact. The record preserves provider, language, status and
   segments (`startMs`, `endMs`, `text`) so a report observation can open the
   matching playback moment.

#### Media and upload rules

1. The client creates an artifact UUID before requesting an upload URL.
2. New R2 keys use `interviews/{sessionId}/artifacts/{artifactId}.{ext}` rather
   than the current `session/question` key. A retry of the same artifact is
   idempotent; a revisit/second attempt is a distinct artifact and cannot
   overwrite the first recording.
3. The server creates the `media_artifacts` row as `uploading` before issuing
   the presigned URL. Confirmation validates ownership, session state, artifact
   ID and expected key, then marks it `uploaded` only after object verification.
4. A transient error becomes `retryable_failed`; only a policy-defined terminal
   error becomes `terminal_failed`. The UI must expose the difference.
5. R2 remains private. Playback URLs are issued only after checking the
   authenticated owner/session is not soft-deleted. A soft-deleted session can
   never mint a new playback URL.
6. Audio transcription is queued only after a media artifact is uploaded. Its
   status is independent of media upload: `not_started`, `queued`, `processing`,
   `completed`, `retryable_failed`, `terminal_failed`. A transcription failure
   does not erase the recording or prevent the candidate from resuming.

#### Event and request rules

- Every mutation includes a caller-generated `eventId`/idempotency key and the
  expected previous session sequence. Duplicate requests return the persisted
  outcome; stale requests are rejected with a refreshable state response.
- `interview_events.sequence` is unique per session, server assigned and
  monotonically increasing. The client may not create state transitions simply
  by changing local React state.
- Generation records retain model, prompt version, safe input hash, output,
  token usage, estimated cost, timing and error class. They never store API
  keys or hidden reasoning.
- Soft-delete checks are applied to every session, report, share and media read
  path—not only to the dashboard query.

#### Migration sequence

1. Add v2 tables/columns and indexes without changing existing reads.
2. Backfill each existing session into configuration revision 1 and create plan
   snapshots from its existing static question/answer relationships. Preserve
   legacy media references.
3. Ship v2 creation/resume behind a feature flag; compare state/read models for
   a small set of test sessions.
4. Switch the setup/interview routes to v2. Keep legacy reads only for old
   sessions until migration evidence is accepted.
5. Do not drop legacy schema in the HackRice timeframe.

#### M1 choices to confirm before implementation

- Does the session timer stop while a candidate has left/paused, then continue
  from its saved elapsed time on resume? **Recommended: yes.**
- When a candidate skips, should the app immediately continue to the next
  question after confirmation, or ask for an optional reason first?
- Should target role initially be free text, a short preset list, or both?
- When an agent revisits a question, may the candidate create a second recorded
  answer, or is the revisit discussion-only?
- What should the app do when time expires mid-answer: let them finish,
  automatically close, or offer a short extension?
- Which transcription provider/languages are required for MVP? The current live
  browser captions are Chrome/Edge-only and must not be the sole saved source.

## M2 — Candidate-controlled interview experience

### Claim

The product feels like an interview because the candidate understands what is
happening and controls when their answer ends. It no longer depends on a five
second silence heuristic as an invisible decision-maker.

### Scope

- Rework the active interview controls around actual candidate tasks.
- Support repeat/rephrase, finish answer, pause/resume and end session.
- Make TTS/caption/camera states understandable and recoverable.
- Remove all controls that have no implemented consequence.

### Implementation tasks

1. Keep the existing camera/microphone controls and Leave control; confirm their
   labels and effects are understandable with a keyboard and screen reader.
2. Add a persistent **Finish answer** action while candidate is recording.
3. Change silence behavior from automatic finalization to a non-blocking,
   dismissible “Finished answering?” suggestion after the agreed threshold.
4. Add **Repeat question**; it replays TTS when available and always reveals
   the exact text. It must not create an agent turn.
5. Add **Rephrase** only if it is in M0 scope. It creates a bounded,
   non-scoring clarification event and maintains the original question's
   intent.
6. Add pause/resume semantics: specify whether recording is segmented or truly
   paused; display a clear privacy state when mic/camera capture stops.
7. Surface no-camera/no-caption/TTS-failed states before and during the session.
8. Remove/defer all nonfunctional meeting toolbar elements. This cleanup is
   already started for Participants, Chat, More options and Share screen.
9. Write a short lobby consent statement that names recording, transcription,
   storage and deletion reality—not aspirational features.

### UX acceptance criteria

- In five seconds, a first-time user can identify: current question, whether
  they are being recorded, how to finish, and how to leave.
- A candidate who pauses for 10 seconds is never silently advanced.
- Every record-affecting action offers feedback; error states use plain language
  and a real recovery action.
- The interface works at 320px, with keyboard-only navigation and without
  sound.
- No click target looks interactive if it has no outcome.

### Validation cases

| Scenario | Expected result |
| --- | --- |
| Candidate says nothing | No empty answer is submitted without explicit Finish/Skip behavior |
| Candidate talks, pauses, then continues | Suggestion may appear; recording continues unless candidate chooses Finish |
| Candidate requests repeat | Same question plays/displays; question position and plan do not change |
| TTS is unavailable | Question remains visible and the user can continue; no dead loading state |
| Browser lacks SpeechRecognition | Lobby warns accurately; fallback follows M0 decision |
| Camera permission denied | Explain failure/retry/fallback without creating a ghost session |
| Keyboard user | All controls have visible focus, names and sensible focus order |

### Evidence

- Browser test coverage for Finish answer and Repeat question.
- Manual mobile/desktop screenshots plus keyboard navigation recording.
- Accessibility pass for labels, live announcements, focus and color contrast.

### Gate criteria

- Candidate can finish an answer deterministically under normal and outage
  conditions.
- Existing camera-recorder tests remain green and new behavior is covered.
- All intentionally removed/deferred controls are absent rather than disabled
  without explanation.

### Gate result

`Pass with stated risk` — live captions now scroll to newest final/interim text
instead of clipping in Chrome, and the interviewer no longer advances on
silence. The candidate has an explicit Finish answer action; silence only
presents a gentle “Finished answering?” suggestion. Repeat pauses local capture
while replaying the exact visible text; rephrase is persisted as a bounded
clarification; Skip requires confirmation; and pause/resume freezes the durable
session timer. Fake conferencing controls are removed. Typecheck, lint, 109
tests and the production build pass. Remaining gate evidence is a manual
keyboard/mobile/browser recording, because the workspace has no attached browser
preview.

---

## M3 — Bounded interviewer-agent orchestrator

### Claim

The interviewer can respond naturally enough to candidate behavior while being
strictly constrained by a persisted plan, a policy and a server-validated
action schema.

### Scope

- Build a server-side `decideNextTurn` service that receives finalized data.
- Return validated actions, not arbitrary text consumed directly by the UI.
- Support the M0-selected candidate intents and bounded follow-ups.
- Record the action, rationale code, model/prompt version and latency.

### Non-goals

- Unbounded real-time conversation or hidden chain-of-thought storage.
- Autonomous scoring while candidate is speaking.
- A model-controlled state machine.

### Implementation tasks

1. Define Zod/JSON-schema contracts for `AgentContext`, `AgentAction` and
   `AgentDecision`; include a small enum of rationale codes such as
   `missing_specific_example`, `needs_tradeoff`, `candidate_requested_repeat`,
   `coverage_complete` and `provider_fallback`.
2. Write a pure policy validator that rejects actions that violate session
   status, plan sequence, configured time, probe count or candidate intent.
3. Add an adapter around the selected LLM. The rest of the app sees only the
   validated decision service, never vendor response shapes.
4. Provide the plan/current transcript summary/allowed actions in the prompt;
   do not send unbounded history blindly.
5. Implement deterministic fallback per action: no follow-up on a model
   timeout; re-use exact question wording for repeat; continue to next planned
   question where permitted.
6. Append an `agent_decisions` record after validation. Store a safe trace
   (versions, latency, action, rationale), not provider secrets or hidden
   reasoning.
7. Connect the response to M2 controls and M1 turn/event persistence.
8. Add a kill switch to disable adaptive probes and run planned questions only.

### Agent scenario corpus

Start with at least 20 authored examples across these groups. Each example has
context, final transcript, candidate intent, permitted expected actions and a
human explanation. The expected output is an action/rationale class—not exact
wording.

| Group | Minimum cases | What it verifies |
| --- | --- | --- |
| Strong complete answer | 3 | Agent acknowledges and progresses instead of inventing a probe |
| Vague answer | 3 | One focused evidence-seeking probe, not generic “tell me more” |
| Candidate asks repeat/rephrase | 3 | Accurate response without changing question intent |
| Short answer/decline | 2 | Respectful prompt/skip behavior within policy |
| Technical ambiguity | 3 | Clarifies terms or constraints rather than falsely correcting candidate |
| Probe limit reached | 2 | Moves on even if more detail could be useful |
| Provider malformed/timeout/rate limit | 2 | Deterministic safe fallback |
| Unsafe/disallowed request | 2 | Refuses/redirects safely |

### Validation

- Contract test validates every model response and logs rejection reason.
- Corpus test runs with a frozen/mock adapter in CI; live-provider sampling is
  separated and never makes CI flaky.
- At least five live runs are reviewed by humans for naturalness, control,
  relevance and incorrect assumptions.
- Measure decision latency median and p95 against the M0 target.

### Gate criteria

- No scenario bypasses policy validation.
- 100% of contract fixtures have a safe output or deterministic fallback.
- The agent never exceeds configured probe count in an end-to-end session.
- The kill switch works and leaves a valid planned interview.

### Gate result

`In progress` — `AgentDecision` has a strict discriminated schema with only
`ask_follow_up`, `move_to_next_question`, and `close_interview`. A pure policy
enforces the time cap, one-follow-up maximum and final-question close behavior;
provider/kill-switch failures fall back to planned progression. Each decision is
created as a durable generation before the provider call and materialized with
a safe trace after validation. A 20-case policy corpus plus malformed-response
tests runs in CI (109 passing tests at this checkpoint). Still required: human
review of live-provider sessions and latency sampling; the configured Gemini key
has previously rate-limited, so fallback behavior is the expected development
path.

---

## M4 — Evidence-linked feedback and report

### Claim

Feedback helps a candidate improve because it is grounded in what they said,
states its confidence/coverage, and never pretends to make an employment
decision.

### Scope

- Select authoritative final transcription path.
- Queue/report evaluation after session completion.
- Create an evidence-linked candidate report and playback route.
- Support report status and recoverable processing failures.

### Required design decisions

- Competencies and rubric levels per interview type.
- Whether and how an aggregate score is presented.
- Evidence threshold to mark a competency as insufficiently observed rather
  than low-scoring.
- Report editing/challenge rules and who can see it.

### Implementation tasks

1. Add a transcription adapter and explicit status lifecycle. Browser captions
   are immediate assistance; they are not automatically authoritative.
2. Queue evaluation only for completed, authorized sessions with usable
   artifacts/transcripts. Make jobs idempotent.
3. Store versioned report and per-competency evaluation items with source turn
   IDs, evaluator/prompt/rubric version and processing state.
4. Design report UI around: what went well, evidence, one practical next step,
   missing coverage and playback/transcript anchors.
5. Add report loading/failed/retry states; do not show an empty “analysis” card
   as completed.
6. Build delete/export/retention behavior required by M0 before broad access.

### Report acceptance criteria

- Each evaluative claim links to the applicable question/answer transcript and
  video time where available.
- The report says “not enough evidence” when coverage is inadequate; it does
  not invent a negative trait.
- The report includes actionable practice guidance, not generic encouragement.
- A candidate cannot see another candidate's report/media.
- Report generation is asynchronous and cannot block ending an interview.

### Validation cases

| Scenario | Expected result |
| --- | --- |
| Complete recording + transcript | Report becomes ready with evidence anchors |
| Missing/failed clip | Report explains unavailable evidence and continues only if policy allows |
| Incomplete session | No misleading final evaluation; status explains next action |
| Weak coverage for one competency | “Insufficient evidence” rather than fabricated score |
| Report worker retries | Exactly one final report version becomes active |
| User requests deletion | Artifacts/report status follow the approved retention/deletion policy |

### Evidence

- Rubric review sign-off and 5–10 handcrafted reference answers.
- Unit/integration tests for report eligibility, ownership, job retries and
  evidence linkage.
- Human review of at least five generated reports using a consistent scorecard.

### Gate criteria

- 100% of reviewed report claims can be traced to evidence or are removed.
- No report makes demographic/biometric/personality assertions outside rubric.
- Failure/retry behavior is visible and recoverable.

### Gate result

`Not started`

---

## M5 — Dashboard as practice command center

### Claim

The dashboard tells a user what to do next based on real session/report state,
and every displayed control leads somewhere useful.

### Scope

- Refine the current signed-in home page and create missing detail/report paths.
- Cover first-time, in-progress, completed-with-processing, completed-with-
  report, failed-upload and returning-user states.
- Preserve a focused dark visual system while improving hierarchy and clarity.

### Implementation tasks

1. Establish home-page priority: resume session (when one exists), then start
   practice, then latest available feedback. Do not surface more than one
   competing primary action.
2. Replace raw totals-only “Your progress” with data that can change a next
   action. Retain a stat only if it is truthful and useful.
3. Add session rows with mode, target/focus, current/report state, date,
   duration when known and one context-appropriate action.
4. Add a composed first-session empty state explaining the three actual steps
   and the privacy/camera expectation.
5. Add report processing/failed cards and a retry/support route per M4 policy.
6. Add the session detail/report destinations before linking to them.
7. Build responsive loading/error/empty variants; ensure keyboard and screen
   reader semantics use headings, lists, links and labelled actions.
8. Remove stale/duplicative status presentation and any remaining fake UI.

### Dashboard state matrix

| User state | Primary surface | Primary action |
| --- | --- | --- |
| No sessions | First-practice explanation | Start practice |
| In-progress session | Resume card naming exact question/progress | Resume interview |
| Completed, report processing | Latest session processing state | View session / processing details |
| Completed, report ready | Latest evidence/next drill summary | Review feedback |
| Upload/report failure | Honest error card | Retry or view recovery instructions |
| Returning with history | Latest recommendation + concise history | Start targeted practice or review report |

### Validation

- Test each row in the state matrix with real fixtures, not conditional UI
  guessed from an empty database.
- Verify all actions navigate to real routes and are authorized.
- Usability test: three users identify their next action and locate their latest
  report without instruction.
- Review desktop/mobile visual hierarchy using screenshots at 320px, 768px and
  1440px.

### Gate criteria

- No dashboard metric is fabricated, stale by design or actionless.
- Every supported session state has an understandable next action.
- Dashboard walkthrough passes with no sessions, interrupted session and report
  failure fixtures.

### Gate result

`Not started`

---

## M6 — End-to-end hardening and demo readiness

### Claim

The project is reliable enough to demonstrate honestly under normal conditions
and recover gracefully from the failures most likely at an event.

### Scope

- Verify all user journeys against the actual deployment/configuration.
- Rehearse outages and recovery paths.
- Package an evidence-backed demo and known-limitations statement.

### Implementation tasks

1. Write a production-like environment checklist: Clerk, database migrations,
   R2 CORS/storage lifecycle, LLM key/limits, TTS key/voice, transcription,
   background worker and observability.
2. Define a one-command or one-page pre-demo health check that verifies only
   safe connectivity/status—not secrets.
3. Add concise structured logs/metrics for session ID, state, artifact status,
   provider latency/error class and report state.
4. Build the demo account/data strategy without presenting synthetic feedback as
   a real customer result.
5. Rehearse: normal interview; no TTS; LLM timeout; upload loss; refresh;
   report delay; unsupported browser.
6. Document known limitations, particularly browser caption compatibility and
   any simulated/fallback behavior.

### Release gate checklist

- [ ] M0–M5 gates are passed or scoped risks are explicitly accepted.
- [ ] Lint, unit tests, integration tests and production build pass.
- [ ] Migrations have been applied/tested on the intended environment.
- [ ] Ownership, consent, retention and deletion paths have a demo-tested story.
- [ ] Each provider has a rate-limit/outage fallback tested once.
- [ ] At least one complete session/report is verified on the demo browser/device.
- [ ] Team can explain what is live, mocked, deferred and why.

### Gate result

`Not started`

---

## M0 decision sheet (fill this in first)

| ID | Decision | Answer | Owner | Date | Status |
| --- | --- | --- | --- | --- | --- |
| M0-D1 | Primary user | People preparing for tech interviews | Founder | Sep 12, 2026 | Accepted |
| M0-D2 | Interview type | Users select granular content types: behavioral, technical concepts, system design and/or code explanation. The agent chooses the distribution; decks/presentations are later. | Founder | Sep 12, 2026 | Accepted |
| M0-D3 | Personalization inputs | Target role plus junior/mid-level/senior skill level determine difficulty. A focus area is editable during a session and applies to future questions. | Founder | Sep 12, 2026 | Accepted |
| M0-D4 | Candidate controls | Join, answer, Finish answer, skip with confirmation, repeat/rephrase, change question visibility/camera/mic/focus area, leave and resume | Founder | Sep 12, 2026 | Accepted |
| M0-D5 | Agent policy | 10/20/30-minute adaptive plan with internal numbered questions; at most one necessary focused follow-up per question. Agent may answer requests, explain its choices, repeat/rephrase and initiate a revisit to a prior question. | Founder | Sep 12, 2026 | Accepted |
| M0-D6 | Feedback promise | Persistent language-based report with strengths, improvements, per-answer feedback, timeline, transcript, video and suggested next practice. Pace/filler review markers are out of MVP. | Founder | Sep 12, 2026 | Accepted |
| M0-D7 | Consent and retention | R2 stores media/reports indefinitely. Soft delete marks a session and all child artifacts inaccessible without physical purge. Candidate-generated sharing is report-only and expires after 7 days. | Founder | Sep 12, 2026 | Accepted |
| M0-D8 | Demo constraints | Local configuration now has Clerk, database, R2, Gemini and ElevenLabs entries. Runtime/provider validation is required; no fixed deadline currently constrains scope. | Founder | Sep 12, 2026 | Accepted |

### M0 decision notes — Sep 12, 2026

#### Audience and format

The initial product is for people preparing for technology interviews. The
setup experience must let a user choose one or more content types:

- technical;
- behavioral;
- system design; and
- code explanation: a LeetCode-style prompt the candidate explains and defends,
  not a live code-editor/algorithm-solving screen.

The candidate chooses **what** belongs in the interview, not a question count
per type. The agent creates an internal numbered plan and chooses the mix/order
within the selected time budget. Pitch decks and presentations are explicitly
outside this milestone. The current single `mode` enum and 1–5 question setup
cannot express this product model and must be replaced during M1/M2.

#### Time-boxed adaptive plan

Sessions are time-based, with **10, 20 and 30 minute** user-selectable
durations. At session creation, the planner creates a target
question sequence with `minimum`, `target`, and `maximum` coverage in the
available time. The user sees elapsed/remaining time and the current question
number; the internal sequence is durable for resume and evaluation. The agent
may finish early when:

- selected competency coverage is complete;
- the candidate explicitly ends the session;
- the candidate repeatedly chooses Skip and cannot/will not continue; or
- a documented technical-recovery policy requires ending safely.

It must **not** end an interview early merely because it judges an answer as
poor, an applicant as unqualified, or a candidate's speech/appearance as
undesirable. A weak or incomplete answer is a reason for a single focused
follow-up (if permitted) or a report observation, not a silent termination.

#### Candidate agency

The candidate must be able to join, answer, skip, change allowed interview
settings, leave, and later resume. M1 must define exactly which settings are
safe to change after session creation. The current product direction is:

- Allow output/accessibility settings (voice, captions, question text
  visibility) at any time.
- Allow camera and microphone toggles at any time, with an explicit capture
  state; their effect on a current answer must be clear.
- Allow the focus area to change while the session is active. The update applies
  only to future planned questions/probes; it creates a versioned plan update
  and never rewrites the question/answer history used by the report.
- Allow pausing/leaving/resuming at any time.
- Allow skip only with a visible confirmation and persist a `skipped` turn
  reason so feedback does not treat it as a weak answer.
- Lock selected content types and completed/active question wording once the
  session begins. This preserves a truthful history and reliable resume.
- Provide both an explicit **Finish answer** control and a non-blocking silence
  suggestion; silence never submits the answer by itself.

#### Agent autonomy

The interviewer has bounded autonomy. Within session policy it may answer a
candidate request, repeat a question, rephrase without changing its intent,
ask at most one necessary focused follow-up, and revisit a prior question. A
revisit is a new linked turn, not an edit to a historical answer. The UI must
make this visible (for example, “Returning to question 2”) and preserve both
attempts for playback/report evidence.

The agent may explain why it asked a follow-up or chose to revisit a question.
It may also answer interview logistics, question clarification and relevant
conceptual questions. If a user asks it to teach or reveal the answer to the
question being assessed, it must move into an explicit **coaching detour**:
pause the assessment, state that the attempt is assisted, and avoid scoring the
subsequent assisted answer as an unassisted performance. This preserves the
user's freedom to learn while keeping reports honest.

#### Video and interview metrics

Video is retained for candidate playback and an evidence timeline. The report
will be language/transcript-based. We will not infer or score a candidate's
confidence, calmness, comfort, emotion, facial expression, eye contact,
appearance, accent or other personal traits from video/audio. Those proxies are
not reliable measures of interview quality and create an unfair product risk.

Candidate-reviewable, transparent timeline events can instead include:

- question started/repeated/rephrased/skipped;
- answer start/end and duration;
- transcript-backed long pauses or restarts, presented as review markers rather
  than mistakes;
- filler-word count/rate only if the user chooses to see it and can inspect the
  matching transcript moments;
- whether the answer supplied rubric-relevant evidence such as a concrete
  example, decision, tradeoff, outcome or metric;
- a direct link from each report observation to the matching transcript and
  video time range.

The report should describe observations and suggestions (for example, “This
answer names the outcome but not your individual decision; practice adding the
choice you made and why”) rather than declare personality judgments such as
“you lacked confidence.”

#### Persistence

Users should retain media for future playback and reports should persist. The
current app stores recordings through an R2 integration; the target is confirmed
as **Cloudflare R2**. Retention is indefinite. Soft deletion is an access-state
change: mark the session and every child artifact/report as deleted and make
them inaccessible to all user, share-link and ordinary application reads. It
does not physically purge R2/database records. R2 objects must remain private;
every playback URL must be authorized against the non-deleted session state.

The initial product should be private to the candidate. The data model and
authorization design should anticipate later candidate-approved sharing with
mentors/recruiters. The first sharing mechanism will be a candidate-generated
share link; it must have a revocation control, a sufficiently unguessable token
and a clear scope before launch. The approved MVP scope is **report only**—no
transcript or video through a share link. Each link expires seven days after
creation and must be revocable by its creator before that time.

#### Device priority and review markers

Laptop is the primary interview device, reflecting how most real interviews
happen. M2/M5 validation must therefore prioritize a laptop camera/microphone,
browser permission flow, keyboard navigation and common laptop viewports before
phone refinement.

Pace and filler-word review markers are deliberately deferred from MVP. They
remain candidates for a later, transcript/time-linked self-review feature, but
will not influence any score or employment-like conclusion.

#### Local configuration handoff

On Sep 12, 2026, a complete project `.env.local` was copied into this worktree
from the authorized sibling HackRice app worktree with owner-only file
permissions. Presence (not values) was verified for Clerk, database, R2,
Gemini and ElevenLabs settings. This is configuration availability only; M6
still requires safe runtime/provider health checks before a demo.

### M0 candidate demo contract

This is the approved demo story to review before M1 begins:

1. On a laptop, a signed-in candidate chooses a 10-, 20- or 30-minute session;
   selects one or more interview content types; enters a target role; selects
   junior, mid-level or senior; and optionally adds a focus area.
2. The app explains recording/camera use, creates a durable adaptive plan and
   enters the interview lobby.
3. The candidate joins, answers a numbered question, can request a repeat or
   rephrase, and explicitly finishes the answer. The agent may ask one needed
   probe, explain its choice, or later return to a prior question as a visible
   linked turn.
4. The candidate can change question visibility, camera, microphone or future
   focus; can Skip with confirmation; and can leave safely.
5. On return, the candidate resumes from their saved plan rather than receiving
   a new/static question set.
6. On completion, the candidate receives a durable language-based report with
   evidence-linked transcript/timeline/video playback, per-answer guidance,
   strengths, improvements and a suggested next drill.
7. The candidate can mark the session deleted, immediately removing it and all
   child artifacts from normal playback/report/share access. They can create a
   revocable report-only share link that expires after seven days.

**M0 gate result:** `pass with stated risk` — product decisions and demo
contract are accepted. Provider runtime health, database migrations and the
complete session/resume behavior remain M1 validation work; there is no fixed
external delivery deadline.

## Current iteration queue

1. Complete and approve M0 decision sheet.
2. Turn approved M0 scope into M1 database/API task tickets and test fixtures.
3. Implement M1 only after the session/resume acceptance cases are confirmed.
4. At each gate, update this document with evidence and choose `pass`, `pass
   with stated risk`, or `rework` before moving forward.
