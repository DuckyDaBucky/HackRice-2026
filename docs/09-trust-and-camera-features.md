# Trust, recording and camera features

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Current implementation

Clerk profile and session owner checks, camera capture and R2 upload wiring are implemented. Public interview routes are intentionally outside Clerk middleware; this does not grant anonymous storage access. Corporate isolation, comprehensive consent/retention policy and production security validation remain work. The standalone Presage wrapper has no end-user authentication and is not connected to candidate scoring. These are product requirements, not a compliance certification.

## Recording and ownership

Before recording, identify what is captured, why, who can access it, which external services process it and how long it is kept. Show an active recording indicator. Preview and device checks should not silently upload media. Users must know whether pausing or ending a session stops all capture.

Practice recordings are private to the candidate by default. Corporate recordings belong to the employer interview workflow under a disclosed policy; access is limited to authorized reviewers. Agree on retention windows before production. Candidate deletion requests and employer retention requirements need an explicit process rather than contradictory UI promises.

Separate consent for recording, optional camera/SDK observations, context reuse and model training. Optional features should not be bundled into an unavoidable grant of unrelated permissions.

## Presage observations

The requested SmartSpectra service is still exploratory. Validate outputs and measurement limitations before exposing any signal. If offered in practice, make observations optional, private and clearly separate from interview-content feedback.

Do not describe physiological measurements as reliable indicators of confidence, competence, honesty or employability. Do not use them to rank applicants or diagnose a condition. Low light, movement, hardware and unsupported inputs may make observations unavailable; report that state plainly.

## Camera-based assistance and suspected cheating

**Founder idea:** HR may receive camera-assisted cheating support. **Proposed bounded interpretation:** optional incident observations for human review, only after a feasibility assessment and clear candidate notice. This is not a confirmed detection capability.

A candidate looking away, pausing, moving, using an assistive device or encountering camera errors is not proof of cheating. Do not infer misconduct from stress or physiological signals. Any future flag needs a timestamp, observable event, uncertainty, reviewer disposition and candidate explanation path. Keep flags outside the performance score and prohibit automatic rejection from a flag.

Prefer explicit interview rules and transparent evidence over speculative surveillance. Interviewer notes and disclosure of allowed resources may be enough for the HackRice demonstration; automated camera detection is deferred.

## Practical access controls

- Authorize organization membership and session assignment server-side.
- Separate private practice context from employer data.
- Encrypt transport and use private media storage.
- Keep API credentials out of client bundles and documentation.
- Limit media download links and log privileged report/media access.
- Preserve records of report corrections and reviewer overrides.
- Delete derived artifacts and external context when the selected policy requires it.

## Accommodations

Offer text questions/captions and readable transcripts. Provide a clear way to request an alternative format when speech, hearing, camera use or timed interaction is inaccessible. Practice mode should allow retries and pacing controls. Corporate timing rules need a visible accommodation path rather than penalizing users indirectly.
