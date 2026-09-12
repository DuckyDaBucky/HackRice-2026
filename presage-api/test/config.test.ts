import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("loadConfig applies safe defaults", () => {
  const config = loadConfig({ SMARTSPECTRA_API_KEY: "test-key" });
  assert.equal(config.port, 8080);
  assert.equal(config.enableTelemetry, false);
  assert.equal(config.logLevel, "warning");
  assert.equal(config.videoAnalysisTimeoutMs, 21_600_000);
});

test("loadConfig requires the vendor API key", () => {
  assert.throws(() => loadConfig({}), /SMARTSPECTRA_API_KEY is required/);
});

test("loadConfig rejects malformed limits", () => {
  assert.throws(
    () => loadConfig({ SMARTSPECTRA_API_KEY: "test-key", MAX_FRAME_BYTES: "many" }),
    /MAX_FRAME_BYTES/,
  );
});
