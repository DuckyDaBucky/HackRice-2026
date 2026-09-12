# HackRice delivery plan

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Current implementation

The app now has a tested workbench, profiles, dashboard, recording/upload and voice paths; the native Presage wrapper is a separate service. The next integration priority is the resume-grounded question-pack handoff, durable transcript/report alignment and recording review. HR and invitations remain future work. The milestones below are a planning sequence, not current completion claims. See [current codebase](14-current-codebase.md).

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

**Stretch:** avatars/art packs, editable persistent learning context and a validated Presage service. Live analysis and live feedback are excluded.

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
