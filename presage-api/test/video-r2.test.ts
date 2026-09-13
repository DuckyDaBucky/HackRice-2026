import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";

import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { R2Error, type R2Fetcher } from "../src/r2.js";
import type { SdkRuntime, SdkSession } from "../src/sdk/contracts.js";

type Callback = (...args: any[]) => void;

class FakeSdk implements SdkSession {
  protected callbacks = new Map<string, Callback>();

  useCustomInput(): this { return this; }
  useFile(): this { return this; }
  start(): void {
    queueMicrotask(() => {
      this.callbacks.get("processingStatus")?.(3);
      this.callbacks.get("frameSentThrough")?.(true, 1000);
      this.callbacks.get("validationStatus")?.(1, 1000, "hint");
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

const baseConfig: AppConfig = {
  host: "127.0.0.1",
  port: 8080,
  smartSpectraApiKey: "test-key",
  enableTelemetry: false,
  logLevel: "warning",
  maxVideoBytes: 1024 * 1024,
  videoAnalysisTimeoutMs: 2_000,
  maxFrameBytes: 1024 * 1024,
  r2: {
    accountId: "test-account",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
    keyPrefix: "interviews/",
  },
};

const runtime: SdkRuntime = {
  sdkVersion: "test-sdk",
  create: () => new FakeSdk(),
  decodeMetrics: (buffer) => ({ decoded: buffer.toString() }),
  metricBundles: { breathing: [0, 1], cardio: [15], face: [11], micromotion: [], eda: [10] },
  metricTypes: { CHEST_BREATHING: 0, PULSE_RATE: 15 },
  processingStatus: { kUninitialized: 0, kIdle: 1, kStarting: 2, kRunning: 3, kStopping: 4, kError: 5 },
  validationCode: { kOk: 0 },
  errorCode: { kOk: 0 },
  pixelFormat: { kRGB: 0, kBGR: 1, kRGBA: 2, kBGRA: 3, kNV12: 4, kNV21: 5, kYUYV: 6 },
  frameTransform: { kNone: 0, kRotate90CW: 1, kRotate90CCW: 2, kRotate180: 3, kMirrorHorizontal: 4, kMirrorVertical: 5 },
  logLevel: { kDebug: 0, kInfo: 1, kWarning: 2, kError: 3, kNone: 4 },
};

function bytesFetcher(data: Buffer): R2Fetcher {
  return async () => ({ stream: Readable.from([data]), contentLength: data.length });
}

async function postKey(app: Awaited<ReturnType<typeof buildApp>>, body: unknown) {
  return app.inject({
    method: "POST",
    url: "/v1/videos/analyze-r2",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(body),
  });
}

test("r2 endpoint advertises itself in capabilities", async (context) => {
  const app = await buildApp({ config: baseConfig, runtime, logger: false });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/v1/capabilities" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().endpoints.videoR2Upload, "/v1/videos/analyze-r2");
});

test("r2 endpoint is unavailable without R2 configuration", async (context) => {
  const { r2: _r2, ...plain } = baseConfig;
  const app = await buildApp({ config: plain, runtime, logger: false });
  context.after(() => app.close());
  const response = await postKey(app, { key: "interviews/s/q.mp4" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "R2_NOT_CONFIGURED");
});

test("r2 endpoint rejects invalid keys", async (context) => {
  const app = await buildApp({
    config: baseConfig,
    runtime,
    logger: false,
    r2Fetcher: bytesFetcher(Buffer.from("data")),
  });
  context.after(() => app.close());
  for (const body of [{}, { key: "" }, { key: "../escape.mp4" }, { key: "/absolute.mp4" }, { key: "other/prefix.mp4" }]) {
    const response = await postKey(app, body);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
    assert.equal(response.json().error.code, "R2_KEY_INVALID");
  }
});

test("r2 endpoint analyzes a fetched object", async (context) => {
  const seen: string[] = [];
  const app = await buildApp({
    config: baseConfig,
    runtime,
    logger: false,
    r2Fetcher: async (bucket, key) => {
      seen.push(`${bucket}/${key}`);
      return { stream: Readable.from([Buffer.from("fake-video-data")]) };
    },
  });
  context.after(() => app.close());
  const response = await postKey(app, { key: "interviews/s123/q1.mp4" });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().status, "completed");
  assert.deepEqual(seen, ["test-bucket/interviews/s123/q1.mp4"]);
});

test("r2 endpoint rejects oversized objects without analyzing", async (context) => {
  const app = await buildApp({
    config: { ...baseConfig, maxVideoBytes: 64 },
    runtime,
    logger: false,
    r2Fetcher: bytesFetcher(Buffer.alloc(256, 1)),
  });
  context.after(() => app.close());
  const response = await postKey(app, { key: "interviews/s123/q1.mp4" });
  assert.equal(response.statusCode, 413);
  assert.equal(response.json().error.code, "VIDEO_TOO_LARGE");
});

test("r2 brief mode drops per-frame and status events", async (context) => {
  const app = await buildApp({
    config: baseConfig,
    runtime,
    logger: false,
    r2Fetcher: bytesFetcher(Buffer.from("fake-video-data")),
  });
  context.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/v1/videos/analyze-r2?brief=true",
    headers: { "content-type": "application/json" },
    payload: JSON.stringify({ key: "interviews/s123/q1.mp4" }),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json();
  const types = body.events.map((event: { type: string }) => event.type);
  assert.ok(!types.includes("processing_status"), types.join(","));
  assert.ok(!types.includes("frame_sent_through"), types.join(","));
  assert.ok(!types.includes("validation_status"), types.join(","));
  assert.ok(types.includes("metrics"), types.join(","));
  assert.ok(types.includes("accumulated_metrics"), types.join(","));
  assert.deepEqual(Object.keys(body.eventCounts).sort(), ["accumulated_metrics", "metrics"]);
});

test("r2 endpoint maps missing keys to 404 and fetch failures to 502", async (context) => {
  const missing = await buildApp({
    config: baseConfig,
    runtime,
    logger: false,
    r2Fetcher: async () => {
      throw new R2Error("R2_KEY_NOT_FOUND", "gone", false);
    },
  });
  context.after(() => missing.close());
  const gone = await postKey(missing, { key: "interviews/s123/q1.mp4" });
  assert.equal(gone.statusCode, 404);
  assert.equal(gone.json().error.code, "R2_KEY_NOT_FOUND");

  const broken = await buildApp({
    config: baseConfig,
    runtime,
    logger: false,
    r2Fetcher: async () => {
      throw new R2Error("R2_FETCH_FAILED", "boom", true);
    },
  });
  context.after(() => broken.close());
  const failed = await postKey(broken, { key: "interviews/s123/q1.mp4" });
  assert.equal(failed.statusCode, 502);
  assert.equal(failed.json().error.code, "R2_FETCH_FAILED");
});
