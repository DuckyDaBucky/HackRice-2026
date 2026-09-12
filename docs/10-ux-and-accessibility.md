# UX and screen inventory

## Shared design principles

Make the current workspace, interview format and recording state unambiguous. Use plain language: “Your answer is uploading” or “Transcript unavailable; retry processing” rather than provider errors. Never show fake processing completion while a provider is unavailable.

Candidate pages should prioritize the question, camera preview and answer controls. HR pages should prioritize interview configuration and evidence review. Optional avatars must not block participation or cover captions.

## Practice screens

1. **Practice home:** start interview, recent reports, saved improvement goals.
2. **Resume/profile:** upload state, parse results, editable experience and projects.
3. **Interview setup:** target position, job description, categories, format and duration.
4. **Device check:** camera/microphone preview, permissions and recording notice.
5. **Recorded answer:** question text, voice playback, record/upload, review and submit.
6. **Live room:** question/captions, interviewer voice/avatar, candidate preview, pause/end/reconnect.
7. **Processing:** stage and recoverable errors; safe navigation away.
8. **Report:** replay, transcript, evidence-linked feedback, breakdown and retry action.

## Corporate screens

1. **Workspace dashboard:** requisitions, invitations and pending reviews.
2. **Role/template editor:** competencies, questions, rubric, answer guides and policies.
3. **Invitation manager:** create/revoke/resend, expiry and completion status.
4. **Candidate landing/device check:** employer, purpose, format and recording terms.
5. **Candidate interview:** reusable recorded/live components with published corporate policies.
6. **Interviewer panel:** question pack, private guidance, follow-ups and notes.
7. **Candidate review:** report, media evidence, transcript correction and human rating.
8. **Workspace settings:** memberships, retention and allowed integrations.

## Voice and art packs

ElevenLabs voice is intended for practice and automated corporate interviews. Text must remain available when audio fails. Provide an accessible stop/replay control for question speech. Voice selection, licensing and live interruption behavior remain implementation decisions.

The founder may upload avatar art packs. Define accepted formats, rights confirmation and animation/lip-sync behavior later. Start with no avatar or a static visual; do not make a complex avatar renderer a prerequisite for interview functionality.

## Empty and error states

Cover: no resume, scanned/unparseable resume, missing target role, denied microphone, denied camera, unsupported upload, network loss, expired invitation, unauthorized workspace, voice unavailable, transcript insufficient, job failed and report not yet ready.

Each state should explain the next action and whether work was saved. A camera failure must not create a cheating flag. A generated question failure should offer a reviewed fallback pack where configured.

## Accessibility acceptance

All primary actions work with keyboard navigation and visible focus. Questions and processing states are readable by assistive technology. Captions are available during voice playback where supported; transcript/replay controls have clear labels. Do not encode ratings only with color. Respect reduced-motion preferences for avatars and transitions.
