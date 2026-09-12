# Presage SmartSpectra feasibility spike

## Current status — September 12, 2026

The research below is historical. A native Node SmartSpectra wrapper now exists in `presage-api/`, exposing uploaded-video HTTP and live WebSocket analysis. It is not a browser SDK, has no end-user auth, and is not wired into the interview UI. See the service README for current contracts. Native processing was not exercised in this audit. See [current codebase](14-current-codebase.md).

## Historical design / checkpoint

## Status

Research only, done to scope work for whoever picks up the biometric
("ML/tracking") piece. No code written against Presage in this repo.
Findings are from Presage's own public docs and GitHub, not from a working
integration, so treat platform claims as documented-but-unverified until
someone actually runs the SDK.

Sources:
- [SmartSpectra SDK docs](https://smartspectra.presagetech.com/docs/)
- [Presage-Security/SmartSpectra on GitHub](https://github.com/Presage-Security/SmartSpectra)
- [SmartSpectra for Developers](https://presagetechnologies.com/for-developers)

## The blocking finding

**SmartSpectra has no browser or WebAssembly build.** Supported platforms
are Android (Kotlin), iOS (Swift), C++ (Windows/Mac/Linux), and
Node.js/Electron 28+. There is no documented REST or cloud API for
uploading video frames from a web client either — processing is on-device,
through their native SDK, authenticated with an API key or OAuth from
their Developer Admin Portal.

Since this whole app is a browser-based Next.js site (see
[14-current-codebase.md](./14-current-codebase.md)), there is no path to
call SmartSpectra directly from our existing client or a normal serverless
API route. This is a platform mismatch, not a missing API key.

## What it actually measures (if we do get it running somewhere)

Pulse rate (40-110 BPM), heart rate variability (NN intervals, RMSSD,
SDNN, Baevsky Stress Index), relative arterial pressure waveform,
breathing rate (5-40 breaths/min) and waveform, and face analysis
(landmarks, blink detection, expressions). Near-real-time, not batch
(docs reference 12-second average pulse rate and 60-second beat-to-beat
stats as update cadences). Free tier exists via their developer portal.

## Options for whoever builds this

1. **Electron wrapper.** Package the app (or a companion window) as
   Electron so the Node.js/Electron SDK build actually runs. This is
   real desktop-app packaging work, not a UI feature, and changes how the
   whole app ships.
2. **Standalone Node.js spike, outside this repo, first.** Before touching
   the Next.js app, confirm the Node SDK can even consume a video stream
   that didn't come from a locally-attached camera device. Presage's docs
   don't confirm whether it accepts an arbitrary frame feed (e.g. relayed
   from a browser over WebSocket) or requires direct local camera access.
   If it requires direct local camera access, an Electron desktop wrapper
   becomes the only real option, not just the easiest one.
3. **Fake it for the web MVP.** Generate plausible heart-rate/breathing
   values (small randomized drift around a baseline) for the demo, and
   label internally that this is not real Presage output. Consistent with
   [09-trust-and-camera-features.md](./09-trust-and-camera-features.md)'s
   requirement to never claim unverified physiological accuracy — if this
   path is taken, it must not be presented to users as real biometric
   analysis, only used as a visual demo device.

## Recommendation

Given the platform mismatch and the time left, (3) is the pragmatic
default for the web app. (1) or (2) are legitimate paths only if someone
has bandwidth to treat this as its own mini-project (likely a separate
Electron shell or a standalone native demo), not a feature bolted onto
the existing Next.js session flow.
