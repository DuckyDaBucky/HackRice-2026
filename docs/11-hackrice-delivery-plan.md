# HackRice delivery plan

## Progress against the first push

Reviewed source: `17f33a59747a1e251334b28e6019602593f35f83` on September 12, 2026. Static source inspection only; runtime behavior has not been tested.

Milestone 0 now has a source-level baseline: app structure, manifest, environment template, Clerk wiring and the database utility are documented in [current codebase](14-current-codebase.md). Local installation, successful login, database connectivity and deployment have not been verified, so milestone 0's runtime exit criterion is still open.

Next concrete work: verify the scaffold with real local configuration, choose the schema/migration strategy, implement ownership checks, then start the recorded-practice vertical slice. A database pool is not yet session persistence, and sign-in UI is not yet workspace isolation. There is no test script or CI workflow in the inspected snapshot.

This is a proposed build sequence, not a promise that all requested features fit the event. Team assignments and deadlines should be added after the first push and agreement on available time.

## Recommended demonstration slice

Deliver one complete recorded practice interview: resume upload/correction → target role → personalized behavioral and technical-behavioral questions → spoken prompt → recorded answer → transcript → evidence-linked feedback.

Then reuse that working foundation for one corporate requisition, invitation and HR report. Include interviewer question/answer guidance as a comparatively contained HR feature. This demonstrates both product modes without making full real-time infrastructure a prerequisite.

## Milestones

| Milestone | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 — Reconcile first push | Actual stack, startup instructions, owner map, secrets template | Team can run the same checkout |
| 1 — Interview foundation | Identity/workspace boundaries, profile, session and media storage | Two test users cannot access each other's sessions |
| 2 — Recorded practice | Parsing, questions, voice, answer recording and transcription | Complete one real recorded interview |
| 3 — Useful report | Rubric evaluation, evidence, replay and retry | Human review finds no invented evidence in demo cases |
| 4 — Corporate path | Requisition, invitation, candidate screen and HR review | Candidate completes an invite and only assigned HR can review |
| 5 — Live spike | Streaming voice/transcript, turns, interruptions and reconnect | Measured interaction meets team-defined usability target |
| 6 — Optional SDK demo | Validated, explicitly optional practice signal | Supported runtime and limitations documented |

## Scope triage

**Core:** working recorded interview and report; real personalization; access boundaries; honest provider/error states.

**Next:** minimal corporate workflow and private interviewer guidance.

**Stretch:** true live practice, live corporate screening, avatars/art packs, editable persistent learning context, Presage service.

**Deferred:** custom model training, automated cheating claims, automatic hiring decisions, meeting bots in Teams or other external platforms, coding judge.

These priorities are proposals. If sponsor requirements make a named integration mandatory, update priorities and document the smallest honest integration demonstration.

## Test scenarios that matter

- End-to-end practice succeeds using a consented sample resume and actual answer recording.
- Both question categories are represented and tied to the target role.
- Transcript/evaluation provider failure creates a visible retryable state.
- Retry submission does not double-create or double-score an answer.
- A malicious resume instruction cannot change application/evaluation rules.
- An unsupported answer is marked insufficient evidence rather than given a fabricated result.
- Changing IDs cannot expose another user's media or HR-only guidance.
- Corporate interviews follow the published attempt policy, separate from practice defaults.
- A report identifies its rubric, transcript and model versions.
- Any SDK output can be disabled without breaking the interview.

## Demo narrative

Show a fictional candidate's resume, correct a parsed field, select a CS role, and explain why the generated question fits that project. Record a short answer, show the transcript and evidence-linked feedback, then demonstrate a targeted retry. Switch to a separate HR workspace to show the approved screening template and private interviewer guide.

If processing is too slow for the stage, keep a previously completed, clearly labeled sample session ready. Do not present fixtures as live API results. Avoid displaying real candidate recordings, credentials or private resumes in the public demo.

## Operating checklist

Before demo: verify credentials, provider quotas, audio routing, microphone permissions, sample assets, private storage, network fallback and visible processing errors. Record actual latency/cost observations after implementation rather than inventing performance budgets now.
