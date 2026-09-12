import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { SdkRuntime, SdkSession } from "../src/sdk/contracts.js";

type Callback = (...args: any[]) => void;

class FakeSdk implements SdkSession {
  processingStatus = 0 as const;
  private callbacks = new Map<string, Callback>();

  useCustomInput(): this { return this; }
  useFile(): this { return this; }
  start(): void {
    queueMicrotask(() => {
      this.callbacks.get("processingStatus")?.(3);
      this.callbacks.get("metrics")?.(Buffer.from("metrics"), 1_000);
      this.callbacks.get("accumulatedMetrics")?.(Buffer.from("all"), 2_000);
      this.callbacks.get("processingStatus")?.(1);
    });
  }
  stop(): void {}
  async stopAsync(): Promise<void> {}
  async destroy(): Promise<void> {}
  requestInsight(): number { return 1; }
  sendFrame(): boolean { return true; }
  on(event: string, callback: Callback): this {
    this.callbacks.set(event, callback);
    return this;
  }
}

const config: AppConfig = {
  host: "127.0.0.1",
  port: 8080,
  smartSpectraApiKey: "test-key",
  enableTelemetry: false,
  logLevel: "warning",
  maxVideoBytes: 1024 * 1024,
  videoAnalysisTimeoutMs: 2_000,
  maxFrameBytes: 1024 * 1024,
};

const runtime: SdkRuntime = {
  sdkVersion: "test-sdk",
  create: () => new FakeSdk(),
  decodeMetrics: (buffer) => ({ decoded: buffer.toString() }),
  metricBundles: {
    breathing: [0, 1],
    cardio: [15],
    face: [11],
    micromotion: [],
    eda: [10],
  },
  metricTypes: {
    CHEST_BREATHING: 0,
    ABDOMEN_BREATHING: 1,
    EDA_TRACE: 10,
    FACE_LANDMARKS: 11,
    PULSE_RATE: 15,
  },
  processingStatus: { kUninitialized: 0, kIdle: 1, kStarting: 2, kRunning: 3, kStopping: 4, kError: 5 },
  validationCode: { kOk: 0 },
  errorCode: { kOk: 0 },
  pixelFormat: { kRGB: 0, kBGR: 1, kRGBA: 2, kBGRA: 3, kNV12: 4, kNV21: 5, kYUYV: 6 },
  frameTransform: { kNone: 0, kRotate90CW: 1, kRotate90CCW: 2, kRotate180: 3, kMirrorHorizontal: 4, kMirrorVertical: 5 },
  logLevel: { kDebug: 0, kInfo: 1, kWarning: 2, kError: 3, kNone: 4 },
};

test("capabilities exposes all metric bundles and transport endpoints", async (context) => {
  const app = await buildApp({ config, runtime, logger: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/v1/capabilities" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.endpoints.liveWebSocket, "/v1/live");
  assert.deepEqual(body.defaultRequestedMetrics, [0, 1, 15, 11, 10]);
});

test("video endpoint returns decoded and raw accumulated data", async (context) => {
  const app = await buildApp({ config, runtime, logger: false });
  context.after(() => app.close());
  const boundary = "presage-test-boundary";
  const payload = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="video"; filename="sample.mp4"\r\n' +
      "Content-Type: video/mp4\r\n\r\n" +
      "fake-video-data\r\n" +
      `--${boundary}--\r\n`,
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/videos/analyze",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  assert.equal(body.status, "completed");
  const accumulated = body.events.find((event: { type: string }) => event.type === "accumulated_metrics");
  assert.deepEqual(accumulated.data, { decoded: "all" });
  assert.equal(accumulated.protobufBase64, Buffer.from("all").toString("base64"));
});

test("video endpoint can stream long-form results as NDJSON", async (context) => {
  const app = await buildApp({ config, runtime, logger: false });
  context.after(() => app.close());
  const boundary = "presage-stream-boundary";
  const payload = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="video"; filename="sample.mp4"\r\n' +
      "Content-Type: video/mp4\r\n\r\n" +
      "fake-video-data\r\n" +
      `--${boundary}--\r\n`,
  );
  const response = await app.inject({
    method: "POST",
    url: "/v1/videos/analyze?stream=true",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.match(response.headers["content-type"] ?? "", /application\/x-ndjson/);
  const lines = response.body.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(lines[0].type, "analysis_started");
  assert.ok(lines.some((line) => line.type === "accumulated_metrics"));
  assert.equal(lines.at(-1).type, "analysis_complete");
});
