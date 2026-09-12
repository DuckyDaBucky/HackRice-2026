# Evaluation and reports

## Implementation checkpoint

Reviewed source: `17f33a59747a1e251334b28e6019602593f35f83` on September 12, 2026. Static source inspection only; runtime behavior has not been tested.

No transcript, rubric, evaluator, report schema, report page or score aggregation function exists. Every formula, coverage threshold and report contract below remains a proposal. The application has no evaluation-provider dependency or test fixtures yet.

## What is evaluated

**Confirmed:** reports include answer rankings/scores, a composite and a breakdown appropriate to the interview and target role, grounded in transcription.

**Proposed scoring boundary:** evaluate answer content and job-relevant communication, not appearance, age, accent, perceived emotion, physiological signals, disability or identity. Do not derive an employability or honesty score from the camera. Report model uncertainty separately from candidate performance.

Practice can adapt difficulty to an editable experience profile. Corporate scoring uses the requisition's approved role-level rubric. Resume tenure may contextualize questions; it is not itself an answer-quality score. The founder's age-based scoring idea is explicitly not included in this proposed design.

## Proposed rubric

Use an anchored 1–5 ordinal scale per applicable dimension, with “insufficient evidence” as a separate state. These anchors and weights are draft product choices, not validated psychometric measurements.

| Dimension | Behavioral evidence | Technical-behavioral evidence |
| --- | --- | --- |
| Relevance | Addresses the actual question | Addresses the technical problem and constraints |
| Specificity and ownership | Explains own actions with concrete detail | Distinguishes own contribution from team work |
| Reasoning | Explains decisions and alternatives | Explains tradeoffs, assumptions and technical logic |
| Outcome and reflection | Describes results, learning and improvements | Discusses validation, failure modes and lessons |
| Clarity | Understandable and organized explanation | Explains technical ideas at the requested depth |

Anchor examples: **1** = materially unaddressed or unsupported; **3** = relevant explanation with some concrete evidence but important gaps; **5** = clear, specific, well-supported answer with thoughtful reasoning. Write question-specific anchors before evaluation. Technical correctness needs its own explicit checks where relevant; eloquence must not substitute for correctness.

## Composite proposal

For fully evaluated dimensions only, an optional normalized index is:

`100 × Σ(weight × (rating − 1) / 4) / Σ(weight)`

This is a display index, not a probability of success or a hiring recommendation. Show dimension coverage and the exact rubric version beside it. Suppress the composite when required dimensions or required answers are missing; do not normalize away missing required evidence. The threshold for sufficient coverage must be chosen before release. Until then, display breakdowns without a composite.

Never mix camera flags, heart-rate estimates, interview completion, or identity checks into this formula. Employer decisions remain human decisions.

## Required report contents

- Session format, role, question pack and rubric versions.
- Processing status, transcript status, and any unavailable evidence.
- Per-question summary, dimension ratings, rationale and supporting transcript excerpts.
- Replay/timestamp references when available, plus editable transcript corrections.
- Strengths, actionable improvements, and optional illustrative stronger responses clearly labeled as examples.
- Composite only when eligible, with weights and coverage visible.
- Evaluator/model/prompt version, generation time and reviewer annotations.
- Separate optional practice observations or integrity observations, with uncertainty and limitations.

## Validation before trusting scores

Create a small, permissioned evaluation set with strong, middling, weak, incomplete and ambiguous answers. Include equally substantive answers expressed in different styles. Human reviewers compare ratings and explanations, check hallucinated evidence, and investigate large disagreements. Record changes to rubric or evaluator as new versions.

A retry must not overwrite an earlier evaluation. Regeneration after transcript correction should create a superseding report with provenance. If transcription fails or evidence contradicts the evaluator, allow manual review rather than fabricate a score.
