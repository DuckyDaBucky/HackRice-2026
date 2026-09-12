# Corporate experience

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Implementation checkpoint

Reviewed source: `17f33a59747a1e251334b28e6019602593f35f83` on September 12, 2026. Static source inspection only; runtime behavior has not been tested.

Clerk is wired into the shared layout and request proxy. There are no organization memberships, HR roles, requisitions, invitation handlers, candidate screening routes or interviewer panels in the application source. The proxy calls `clerkMiddleware()` with no explicit protection callback; no role or resource-ownership checks are present. Do not describe corporate isolation as implemented. These workflows remain requirements for future work.

## HR role setup

**Confirmed:** HR uses the same underlying contextual question-generation technology through a dedicated corporate UI. It can send an automated screening interview or skip the automated screen and obtain questions for a human interviewer.

**Proposed requisition configuration:** role title, job description, role level, competencies, standardized rubric, interview duration, required questions, personalized questions, response format, candidate retry policy, invitation expiry and report-sharing policy.

HR reviews generated questions before publishing an interview template. Save the approved template and rubric version. A later edit must not silently alter an already completed interview's grading criteria.

## Automated screening

1. HR selects a requisition and publishes an approved interview template.
2. HR invites a candidate with a scoped, expiring invitation.
3. The candidate sees employer identity, expected duration, format, media/data use and any retry limits.
4. The candidate confirms their resume/profile and completes a device check.
5. The system delivers questions in text and ElevenLabs voice, optionally with an avatar.
6. The candidate records and submits answers according to the invitation; analysis follows submission.
7. Processing creates transcript and evidence-based evaluation for authorized reviewers.
8. HR reviews the original answer and can annotate or dispute AI feedback before any decision.

An automated screen uses shared interview components but is not a candidate's personal practice session. Employers cannot retrieve earlier practice sessions simply because the candidate accepts an invitation.

## Assisted human interviewing

The interviewer can skip screening and open a question pack directly. Each question includes what it tests, resume context where appropriate, suggested follow-ups, and an answer guide suited to the role.

**Confirmed concept:** help a nontechnical interviewer understand a strong answer. **Proposed implementation:** a private interviewer panel provides expected concepts, acceptable alternatives, common misconceptions and probing questions. Avoid a single supposedly universal “optimal answer”; open-ended technical questions often have multiple defensible approaches.

The candidate-facing page must never receive hidden answer guides or interviewer notes in its API responses. Hiding elements visually is insufficient.

## Review dashboard

Proposed views: requisition list, invitation statuses, interview sessions, processing queue, candidate report, replay with transcript, rubric evidence, reviewer notes, and export. Display incomplete or low-confidence reports prominently. Keep AI output separate from human ratings and notes; log human overrides and reasons.

Use job-relevant rubrics rather than age or unrelated personal traits. A role-level rubric should be shared across candidates for that role. Personalized questions can vary while testing comparable competencies; direct numeric comparison is inappropriate when rubrics or question difficulty differ materially.

## Later expansion

**Exploratory:** a meeting assistant in existing platforms such as Teams, similar to the meeting-bot experience of Otter.ai. This requires a new integration design for platform permissions, participant notice, joining, capture and recording ownership. It is not a prerequisite for the in-app interview flow.
