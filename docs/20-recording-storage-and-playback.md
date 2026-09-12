# Recording storage and playback

## Current status — September 12, 2026

R2 signing, the upload sink and owner-checked confirmation actions are implemented. A playback signing helper exists, but the full timestamped report/review player is still proposed. Workbench text evaluation exists; durable transcript alignment with uploaded clips remains incomplete. The design below is the original implementation proposal. See [current codebase](14-current-codebase.md).

## Historical design / checkpoint

## Status

Expands on an idea already implicit in
[05-architecture.md](./05-architecture.md) ("Private object storage") and
[04-evaluation-and-reports.md](./04-evaluation-and-reports.md) ("Replay/
timestamp references when available"), made concrete here: recorded
answers get uploaded to object storage, and a session's review screen gets
a video player with a timeline of feedback markers, not just a duration
and a status pill.

Split into two parts with very different feasibility right now:

1. **Storage and playback** — buildable this hackathon. Just needs an
   object storage bucket and a player component.
2. **Timestamped inaccuracy/positive markers** — depends on transcription
   and evaluation existing first (still "not implemented" per
   [14-current-codebase.md](./14-current-codebase.md)). Spec'd here as a
   data contract so it can be built in parallel once that pipeline lands,
   not something this doc claims is ready today.

## Part 1: storage and upload (buildable now)

### Storage choice

**Recommendation: Vultr Object Storage** (S3-compatible). It's already
the project's intended infra provider ([05-architecture.md](./05-architecture.md))
and one of the MLH sponsor tracks being targeted
([product-overview context], see root docs), so using it for real here is
strictly better than picking an unrelated provider. Any S3-compatible
client works against it (`@aws-sdk/client-s3` with a custom endpoint, or a
lighter presigned-URL helper) since Vultr doesn't require its own SDK.

This needs real provisioning (bucket + access keys) before it's usable —
same shape of blocker as TigerData and Clerk earlier in this project. Not
done yet.

### Upload flow

Direct-to-storage upload, not through our own server, so multi-minute
video blobs never pass through the Next.js process:

1. Client finishes recording a clip (already happens today via
   `useCameraRecorder`).
2. Client asks a new route, `POST /api/interview/upload-url`, for a
   presigned `PUT` URL scoped to that `sessionId`/`questionId`. The route
   validates the request server-side and returns a short-lived URL plus
   the storage key it corresponds to.
3. Client `PUT`s the blob straight to that URL.
4. Client confirms success back to the app (replaces today's
   `inMemorySink`, which only logs), which is what should set
   `answer_attempts.media_ref` and `upload_status = 'uploaded'` in the
   schema from [18-data-model-slice.md](./18-data-model-slice.md) — that
   table already has exactly this shape, it just has nothing writing to
   it yet.

Failure handling: if the `PUT` fails, `upload_status` stays `'failed'` or
`'pending'` and the review screen should say so plainly rather than
silently losing the clip, consistent with
[09-trust-and-camera-features.md](./09-trust-and-camera-features.md)'s
requirement to never fake a successful upload.

### Playback UI (buildable now, degrades gracefully without markers)

On the review screen, each answered question gets a real `<video>` player
sourced from its `media_ref` (a signed GET URL, same pattern as the
upload), with standard controls plus a timeline strip below it. With no
annotations yet, the timeline is just a normal scrubber — this works today
once upload exists, independent of Part 2.

## Part 2: timestamped feedback markers (depends on evaluation existing)

### What has to exist first

Per [04-evaluation-and-reports.md](./04-evaluation-and-reports.md) and
[07-data-and-api-design.md](./07-data-and-api-design.md): a `TranscriptVersion`
with timed segments, and an `EvaluationVersion` whose dimension results
reference those segments. Neither exists in this repo yet. This section is
a data contract to build against once they do, not a claim that markers
work today.

### Marker data shape (proposed)

```ts
interface FeedbackMarker {
  id: string;
  attemptId: string; // answer_attempts.id
  timestampMs: number; // position within that clip
  kind: "positive" | "concern";
  label: string; // short, e.g. "Concrete example" or "Vague on outcome"
  evidenceExcerpt: string; // transcript excerpt backing the marker
}
```

Sourced from `EvaluationVersion`'s per-dimension evidence
([07-data-and-api-design.md](./07-data-and-api-design.md#core-records)
already calls for "evidence references, reject references to nonexistent
segments") — a marker without a real transcript timestamp behind it must
not be shown. No inventing plausible-looking feedback the model didn't
actually ground in the transcript; that's the same evidence-linking rule
[04-evaluation-and-reports.md](./04-evaluation-and-reports.md) already
sets for reports generally, just applied at the marker level.

### Timeline UI (proposed)

Below the video scrubber: small colored ticks at each marker's
`timestampMs` position (green for `positive`, amber for `concern`),
clicking a tick seeks the video there and shows `label` +
`evidenceExcerpt`. Same rule as elsewhere in this project: an unavailable
or not-yet-processed evaluation shows "feedback not ready yet," not an
empty timeline pretending there was nothing to flag.

## What this doesn't change

The live in-call features being built right now (live captions, live
follow-up questions — see the follow-up work in `app/src/lib/follow-up/`)
are unrelated to this: those are real-time and disappear after the call,
this is what happens to the recording afterward. Both can exist
independently.
