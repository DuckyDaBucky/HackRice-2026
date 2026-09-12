# Presage API

A small TypeScript service that exposes the Presage SmartSpectra Node SDK through language-neutral HTTP and WebSocket contracts. It uses Fastify, requests every metric bundle by default, and returns both decoded JSON and the original protobuf bytes.

The implementation targets `@smartspectra/node-sdk` 3.3.0. The service requires Node.js 20.12 or newer, a supported 64-bit platform, glibc 2.35 or newer on Linux, network access for authentication, and a SmartSpectra API key with permission for every requested metric. Linux also needs a functioning Vulkan driver for the SDK's inference backend. Headless Linux additionally needs D-Bus plus a Secret Service backend so SmartSpectra can persist its device identity. The included image installs Mesa's software Vulkan driver, D-Bus, and GNOME Keyring and starts an isolated session bus/keyring before the API process.

## Run locally

```sh
cp .env.example .env
# Set SMARTSPECTRA_API_KEY in .env.
npm install
npm run dev
```

Or use the Node 24 Debian container:

```sh
cp .env.example .env
# Set SMARTSPECTRA_API_KEY in .env.
docker compose up --build
```

The service listens on port 8080 by default. `GET /health` reports liveness and the active SDK session, while `GET /v1/capabilities` reports the runtime SDK version, all bundle codes, enums, event names, and endpoint paths.

[`openapi.yaml`](openapi.yaml) is the machine-readable HTTP contract. The binary WebSocket framing is documented below because OpenAPI does not model duplex message protocols.

Do not put the vendor API key in a browser or mobile client. This wrapper keeps it in the service process. The wrapper itself does not implement end-user authentication; deploy it on a private network or behind the application's authenticated gateway.

## Whole-video HTTP analysis

`POST /v1/videos/analyze` accepts exactly one `multipart/form-data` file. The field name is conventionally `video`, but any file field name is accepted. The call stays open until the SDK reaches its terminal state and returns every captured event.

```sh
curl --fail-with-body \
  -F 'video=@interview.mp4;type=video/mp4' \
  'http://localhost:8080/v1/videos/analyze' \
  -o result.json
```

For long recordings, add `?stream=true` to receive newline-delimited JSON as events are produced. The first line is `analysis_started`, followed by SDK events, and the last line is `analysis_complete` or `analysis_failed`. This avoids retaining the entire result in the service's event array:

```sh
curl --no-buffer --fail-with-body \
  -F 'video=@long-interview.mp4;type=video/mp4' \
  'http://localhost:8080/v1/videos/analyze?stream=true' \
  -o result.ndjson
```

Optional query parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `stream` | `false` | Return incremental `application/x-ndjson` instead of one aggregate JSON document. Recommended for long videos. |
| `includeRawProtobuf` | `true` | Include original metric protobuf bytes as base64. Insight protobuf is always preserved. |
| `includeVideoOutput` | `false` | Include every SDK processed-video frame as base64. This can make responses extremely large. |
| `interframeDelayMs` | `0` | Delay between decoded video frames. Zero processes as fast as possible. |
| `startOffsetMs` | `0` | Seek into the uploaded video. |
| `maxDurationMs` | `0` | Limit analyzed content; zero means no SDK limit. |
| `frameTransform` | `kNone` | Numeric code or name such as `Rotate90CW` or `kMirrorHorizontal`. |

The response contains `analysisId`, `sdkVersion`, the requested numeric metric codes, per-event counts, and the ordered `events` array. Uploaded media is created with owner-only permissions under the system temporary directory and removed in a `finally` block after success or failure.

## Live WebSocket analysis

Connect to `ws://localhost:8080/v1/live`. The server first sends a `hello` JSON message. Send this JSON control message before sending frames:

```json
{
  "type": "start",
  "width": 1280,
  "height": 720,
  "stride": 3840,
  "pixelFormat": "RGB",
  "frameTransform": "None"
}
```

When `requestedMetrics` is omitted, the service requests the union of the breathing, cardio, face, micromotion, and EDA bundles. You can explicitly pass the numeric codes returned by `/v1/capabilities` if an API key is provisioned for only a subset.

After `start`, each client-to-server binary WebSocket message is one raw frame:

```text
byte 0..7    unsigned 64-bit big-endian capture timestamp, microseconds
byte 8..end  raw pixels in the declared format
```

Timestamps must be strictly increasing and no larger than JavaScript's safe integer limit. Frame sizes are validated from height and stride. Supported formats are RGB, BGR, RGBA, BGRA, NV12, NV21, and YUYV. For example, an RGB frame uses `stride * height` bytes after the timestamp header.

Control messages after start:

```json
{"type":"insight","prompt":"Summarize the current measurements."}
{"type":"stop"}
```

For a runnable webcam client, see the Python
[`examples/camera_debug.py`](examples/camera_debug.py) example. It captures
OpenCV BGR frames, prints live status/validation/metric events, and can save the
complete event stream as JSONL for debugging.

`includeRawProtobuf=false` can be added to the WebSocket URL to omit duplicate protobuf bytes from metric events. `includeVideoOutput=true` enables base64 processed-frame events.

## Output events

All server events are UTF-8 JSON and include `type` plus `emittedAt`:

| Event | Contents |
| --- | --- |
| `processing_status` | Stable numeric SDK state and its symbolic name. |
| `validation_status` | Readiness code/name, capture timestamp, and SDK hint. |
| `metrics` | Decoded complete `Metrics` message, capture timestamp, and optional raw protobuf. |
| `accumulated_metrics` | Full end-of-session decoded message and optional raw protobuf. |
| `insight` | Request ID and raw Insight protobuf bytes. The Node SDK does not ship an Insight decoder. |
| `sdk_error` | Numeric/name code, safe message, and retryability. |
| `frame_sent_through` | Whether a submitted frame traversed the pipeline. |
| `video_output` | Dimensions, format, timestamp, and processed pixels; opt-in due to size. |

Decoded metrics retain all fields produced by the SDK: breathing rate/traces/amplitude/apnea/line length/baseline/inhale-exhale ratio, glute and knee micromotion, EDA trace, face landmarks/blinking/talking/expressions, and cardio pulse rate/arterial-pressure trace/HRV. Unsupported or unauthorized metrics can remain empty even though their codes were requested.

## Concurrency and scaling

SmartSpectra's native SDK state is process-global and its own documentation requires one pipeline to be destroyed before a replacement is constructed. This service therefore permits one active live or uploaded-video analysis per process. A competing HTTP call receives `409 SDK_BUSY`; a competing WebSocket receives an error and closes with code 1013.

Scale with one session per container and route each session to an available replica. Do not increase in-process concurrency without a future vendor guarantee that the native global-state restriction has changed.

## Commands

```sh
npm run typecheck
npm test
npm run build
npm start
```

Tests use an injected SDK adapter, so they do not need a Presage key, real video, camera hardware, or credits. A true integration test still requires a provisioned key and a well-lit 30–60 second face video.
