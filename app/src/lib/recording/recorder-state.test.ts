import { describe, expect, it } from "vitest";
import { recorderReducer } from "./recorder-state";

describe("recorderReducer", () => {
  it("moves from idle to requesting-permission", () => {
    expect(recorderReducer("idle", { type: "REQUEST_PERMISSION" })).toBe(
      "requesting-permission",
    );
  });

  it("moves from requesting-permission to ready on grant", () => {
    expect(
      recorderReducer("requesting-permission", { type: "PERMISSION_GRANTED" }),
    ).toBe("ready");
  });

  it("moves from requesting-permission to error on denial", () => {
    expect(
      recorderReducer("requesting-permission", { type: "PERMISSION_DENIED" }),
    ).toBe("error");
  });

  it("moves from ready to recording on start", () => {
    expect(recorderReducer("ready", { type: "START" })).toBe("recording");
  });

  it("pauses and resumes", () => {
    expect(recorderReducer("recording", { type: "PAUSE" })).toBe("paused");
    expect(recorderReducer("paused", { type: "RESUME" })).toBe("recording");
  });

  it("stops from recording or paused", () => {
    expect(recorderReducer("recording", { type: "STOP" })).toBe("stopped");
    expect(recorderReducer("paused", { type: "STOP" })).toBe("stopped");
  });

  it("returns to ready for the next question after stopping", () => {
    expect(
      recorderReducer("stopped", { type: "RESET_FOR_NEXT_QUESTION" }),
    ).toBe("ready");
  });

  it("moves to error on a device error while recording or ready", () => {
    expect(recorderReducer("recording", { type: "DEVICE_ERROR" })).toBe("error");
    expect(recorderReducer("ready", { type: "DEVICE_ERROR" })).toBe("error");
  });

  it("ignores events that aren't valid for the current state", () => {
    expect(recorderReducer("idle", { type: "STOP" })).toBe("idle");
    expect(recorderReducer("stopped", { type: "PAUSE" })).toBe("stopped");
    expect(recorderReducer("error", { type: "START" })).toBe("error");
  });
});
