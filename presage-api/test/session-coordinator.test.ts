import assert from "node:assert/strict";
import test from "node:test";

import { SessionCoordinator } from "../src/session-coordinator.js";

test("only one SmartSpectra session can hold the process-global lease", () => {
  const coordinator = new SessionCoordinator();
  const first = coordinator.tryAcquire("first");
  assert.ok(first);
  assert.equal(coordinator.tryAcquire("second"), null);
  first.release();
  assert.ok(coordinator.tryAcquire("second"));
});

test("shutdown invokes active session cleanup", async () => {
  const coordinator = new SessionCoordinator();
  const lease = coordinator.tryAcquire("first");
  assert.ok(lease);
  let cleaned = false;
  lease.setCleanup(async () => {
    cleaned = true;
  });
  await coordinator.shutdown();
  assert.equal(cleaned, true);
});
