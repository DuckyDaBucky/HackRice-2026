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

test("loadConfig leaves R2 unconfigured by default", () => {
  const config = loadConfig({ SMARTSPECTRA_API_KEY: "test-key" });
  assert.equal(config.r2, undefined);
});

test("loadConfig rejects partial R2 configuration", () => {
  assert.throws(
    () => loadConfig({ SMARTSPECTRA_API_KEY: "test-key", R2_BUCKET: "clips" }),
    /R2 configuration is incomplete/,
  );
});

test("loadConfig parses a complete R2 configuration", () => {
  const config = loadConfig({
    SMARTSPECTRA_API_KEY: "test-key",
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "id",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "clips",
  });
  assert.deepEqual(config.r2, {
    accountId: "acct",
    accessKeyId: "id",
    secretAccessKey: "secret",
    bucket: "clips",
    keyPrefix: "",
  });
});
