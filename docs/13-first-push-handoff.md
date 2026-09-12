# First-push handoff and amendment guide

## Starting state

The documentation was authored in the existing local HackRice checkout at `Developer/Hackathons/HackRice 2026/HackRice-2026`. At authoring time the checkout had no implementation files or commits. A remote check required GitHub authentication, so the remote's latest contents could not be verified. The current chat working directory (`Documents/ChatGPT/Hire`) was not itself a Git repository.

No application framework has been scaffolded here, no dependency installed for this documentation task, and no claim made that the product runs. The `docs/` directory is intended to coexist with the friend's first push.

## Safe reconciliation

1. Preserve these local documentation files before pulling or switching branches. Check for untracked files and remote path collisions.
2. Once local GitHub authentication works, fetch and inspect the actual remote default branch and first push.
3. Compare any existing remote docs with this baseline before copying or merging. Never overwrite a friend's files simply because their names match.
4. Bring the documentation onto the team's chosen branch following its workflow. There is no instruction here to force-push, reset, delete history or replace the remote branch.
5. Read repository instructions and the application's README, manifests and environment examples.
6. Reconcile architecture and integration docs against code, keeping unimplemented intentions marked proposed.
7. Add actual local startup commands, framework/runtime versions, environment variable names and deployment instructions only after verification.
8. Review the resulting diff with the team, then commit/publish according to the agreed workflow.

## Reconciliation matrix

| Area | Inspect in first push | Update |
| --- | --- | --- |
| App structure | Routes, screens, package manifests | Architecture and UX inventory |
| Identity | Auth provider, memberships, authorization | Corporate flow and data isolation |
| Resume/media | Upload paths, parsing, storage policies | Practice flow and data contracts |
| AI | Backboard/Gemini/LangChain adapters and prompts | Integrations and context ownership |
| Voice/transcription | Providers, streaming/batch interfaces | Integration register and live readiness |
| Presage | SDK/runtime/service proof | Exploratory scope and supported outputs |
| Reports | Rubrics, evidence references, report schemas | Evaluation and validation plan |
| Infrastructure | Vultr resources, deploy scripts, secrets handling | Actual deployment instructions |
| Tests | Existing checks and end-to-end fixtures | Delivery exit evidence |

## Definition of documented completion

A feature is “implemented” only when its code path exists and relevant behavior has been verified. An installed SDK, mock response, UI placeholder or API key is not enough. Record feature status as planned, in progress, implemented-unverified, verified, or deferred.

When amending the founder's plan, update all affected docs, add a decision if scope changes, and append a change-log entry. Preserve the distinction between personal practice feedback and employer evaluation throughout future changes.
