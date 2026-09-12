# Proposed data and API design

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Current implementation

The app now has pg/Drizzle, migrations, session/attempt queries, Clerk-owned profiles, versioned research storage, server actions and API handlers. Entities below remain the broader product design; use `app/src/lib/db/schema.ts`, the SQL assets and [current codebase](14-current-codebase.md) for implemented names. Organization and invitation records remain future work.

## Core records

| Record | Important fields and relationships |
| --- | --- |
| User | Identity reference, display name, preferences |
| Organization / Membership | Organization, user, role, active state |
| CandidateProfile | Owner, resume version, corrected experience, projects, skills |
| ResumeAsset | Owner/workspace, private object key, MIME, processing state, retention |
| Requisition | Organization, target role, level, competencies, owner |
| InterviewTemplate | Requisition or practice scope, version, format, question policy, rubric |
| Question / QuestionPack | Text, category, competency, resume evidence, difficulty, provenance |
| RubricVersion | Dimensions, anchors, weights, required coverage |
| Invitation | Organization, intended candidate, template version, expiry, redemption state |
| InterviewSession | Workspace, participant, mode, format, template/profile versions, lifecycle |
| AnswerAttempt | Session/question, attempt number, media references, submission state |
| TranscriptVersion | Answer, segments, timings, provider, corrections and provenance |
| EvaluationVersion | Transcript/rubric/model/prompt versions, evidence, dimension results |
| Report | Session, evaluation references, coverage, summary, publication audience |
| PracticeContext | User-owned learning notes, originating report, version, reset state |
| ConsentRecord | Actor, purpose, policy version, timestamp, withdrawal status |
| Observation | Optional signal/incident, timestamp, quality, explanation, review status |
| AuditEvent | Actor, action, target, workspace, timestamp; no raw media payload |

Store submitted snapshots so later resume edits cannot retroactively change an interview. Employer-specific profiles are separate snapshots with explicit candidate submission; do not hand HR a pointer to all personal profile history.

## Proposed API surface

| Method and route | Purpose / authorization |
| --- | --- |
| POST /resumes/uploads | Authorize an owned resume upload |
| POST /resumes/{id}/parse | Enqueue parsing for an accessible asset |
| PATCH /profiles/{id} | Candidate confirms/corrects own profile |
| POST /question-packs | Generate from permitted profile and role context |
| POST /sessions | Create practice session or approved corporate session |
| GET /sessions/{id} | Return only fields appropriate to caller role |
| POST /sessions/{id}/answers/uploads | Authorize upload for active question/attempt |
| POST /answers/{id}/submit | Finalize verified upload; require idempotency key |
| POST /sessions/{id}/submit | Validate completion policy and enqueue processing |
| GET /sessions/{id}/report | Owner or assigned corporate reviewer |
| POST /transcripts/{id}/corrections | Create correction version with audit provenance |
| POST /organizations/{id}/requisitions | Authorized HR configuration |
| POST /requisitions/{id}/invitations | Authorized invitation creation |
| POST /invitations/{token}/redeem | Exchange expiring invitation for scoped session access |
| DELETE /sessions/{id} | Apply authorized deletion/retention workflow |

These routes are a design proposal, not existing endpoints. Live transport, organization membership management, report export and webhook contracts require additional design when implemented.

## Validation and isolation

Question output includes category, competency, prompt, suggested follow-ups and profile evidence references. Employer-only answer guidance must be serialized separately. Evaluation output includes dimension, rating or insufficient-evidence status, rationale and transcript references; reject references to nonexistent segments.

Return structured errors with stable code, user-safe message, retryability and request identifier. Do not return provider credentials or raw vendor errors. Validate ownership on every nested identifier: an answer cannot be attached to another user's session just because its ID is valid.

Signed uploads need MIME/size constraints and completion validation. Download URLs expire and are issued only after authorization. Deletion propagates to artifacts and provider-held context where supported; record pending or failed deletion rather than falsely confirming completion.
