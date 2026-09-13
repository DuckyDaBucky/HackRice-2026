import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";
import type WebSocket from "ws";
import { WebSocket as WebSocketState } from "ws";

import type { AppConfig } from "../config.js";
import { sdkErrorDetails } from "../errors.js";
import type { SessionCoordinator, SessionLease } from "../session-coordinator.js";
import type {
  FrameTransformValue,
  PixelFormatValue,
  SdkRuntime,
  SdkSession,
} from "../sdk/contracts.js";
import { allMetricCodes, enumName, wireSdkEvents } from "../sdk/events.js";

interface LiveQuery {
  includeRawProtobuf?: string;
  includeVideoOutput?: string;
}

interface StartMessage {
  type: "start";
  width: number;
  height: number;
  stride: number;
  pixelFormat: string | number;
  frameTransform?: string | number;
  requestedMetrics?: number[];
}

interface FrameDescription {
  width: number;
  height: number;
  stride: number;
  pixelFormat: PixelFormatValue;
}

const SDK_ERROR_EVENT_GRACE_MS = 1_000;

export interface LiveRouteDependencies {
  config: AppConfig;
  coordinator: SessionCoordinator;
  runtime: SdkRuntime;
}

function send(socket: WebSocket, body: Record<string, unknown>): void {
  if (socket.readyState === WebSocketState.OPEN) socket.send(JSON.stringify(body));
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function enumValue(
  values: Readonly<Record<string, number>>,
  input: string | number | undefined,
  fallback?: number,
): number {
  if (input === undefined && fallback !== undefined) return fallback;
  if (typeof input === "number" && Object.values(values).includes(input)) return input;
  if (typeof input === "string") {
    const direct = Number(input);
    if (Number.isInteger(direct) && Object.values(values).includes(direct)) return direct;
    const normalized = input.startsWith("k") ? input : `k${input}`;
    const entry = Object.entries(values).find(
      ([name]) => name.toLowerCase() === normalized.toLowerCase(),
    );
    if (entry) return entry[1];
  }
  throw new Error(`Unsupported enum value: ${String(input)}`);
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return Number(value);
}

function parseStartMessage(runtime: SdkRuntime, input: unknown): StartMessage & FrameDescription {
  if (!input || typeof input !== "object") throw new Error("Control message must be an object");
  const candidate = input as Partial<StartMessage>;
  if (candidate.type !== "start") throw new Error("The first control message must have type=start");

  const width = positiveInteger(candidate.width, "width");
  const height = positiveInteger(candidate.height, "height");
  const stride = positiveInteger(candidate.stride, "stride");
  if (width > 7680 || height > 4320) throw new Error("Frame dimensions exceed 7680x4320");

  const pixelFormat = enumValue(runtime.pixelFormat, candidate.pixelFormat) as PixelFormatValue;
  const minimumStride =
    pixelFormat === 0 || pixelFormat === 1
      ? width * 3
      : pixelFormat === 2 || pixelFormat === 3
        ? width * 4
        : pixelFormat === 6
          ? width * 2
          : width;
  if (stride < minimumStride) throw new Error(`stride must be at least ${minimumStride}`);

  if (
    candidate.requestedMetrics !== undefined &&
    (!Array.isArray(candidate.requestedMetrics) ||
      candidate.requestedMetrics.some((metric) => !Number.isSafeInteger(metric) || metric < 0))
  ) {
    throw new Error("requestedMetrics must be an array of non-negative integer metric codes");
  }

  return {
    ...candidate,
    type: "start",
    width,
    height,
    stride,
    pixelFormat,
  } as StartMessage & FrameDescription;
}

function expectedFrameBytes(frame: FrameDescription): number {
  if (frame.pixelFormat === 4 || frame.pixelFormat === 5) {
    return Math.floor(frame.stride * frame.height * 1.5);
  }
  return frame.stride * frame.height;
}

function rawDataToBuffer(data: WebSocket.RawData): Buffer {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  return data;
}

function logLevelValue(config: AppConfig, runtime: SdkRuntime): number {
  const key = `k${config.logLevel[0]?.toUpperCase()}${config.logLevel.slice(1)}`;
  return runtime.logLevel[key] ?? 2;
}

export async function registerLiveRoute(
  app: FastifyInstance,
  dependencies: LiveRouteDependencies,
): Promise<void> {
  const { config, coordinator, runtime } = dependencies;

  app.get<{ Querystring: LiveQuery }>(
    "/v1/live",
    { websocket: true },
    (socket, request: FastifyRequest<{ Querystring: LiveQuery }>) => {
      const sessionId = randomUUID();
      let lease: SessionLease | null = null;
      let sdk: SdkSession | null = null;
      let frame: FrameDescription | null = null;
      let lastTimestampUs = -1;
      let cleanupPromise: Promise<void> | null = null;
      let sdkErrorCloseTimer: NodeJS.Timeout | null = null;

      const clearSdkErrorCloseTimer = (): void => {
        if (!sdkErrorCloseTimer) return;
        clearTimeout(sdkErrorCloseTimer);
        sdkErrorCloseTimer = null;
      };

      const closeAfterSdkErrorGracePeriod = (): void => {
        if (sdkErrorCloseTimer) return;
        sdkErrorCloseTimer = setTimeout(() => {
          sdkErrorCloseTimer = null;
          if (socket.readyState === WebSocketState.OPEN) {
            socket.close(1011, "SmartSpectra processing error");
          }
        }, SDK_ERROR_EVENT_GRACE_MS);
        sdkErrorCloseTimer.unref();
      };

      const cleanup = (): Promise<void> => {
        if (cleanupPromise) return cleanupPromise;
        clearSdkErrorCloseTimer();
        cleanupPromise = (async () => {
          const current = sdk;
          sdk = null;
          if (current) {
            try {
              await current.stopAsync();
            } catch {
              // destroy() still runs after a stop failure.
            }
            await current.destroy();
          }
          lease?.release();
          lease = null;
        })();
        return cleanupPromise;
      };

      queueMicrotask(() => {
        send(socket, {
          type: "hello",
          sessionId,
          sdkVersion: runtime.sdkVersion,
          binaryFrameHeader: "8-byte unsigned big-endian timestamp in microseconds",
        });
      });

      socket.on("message", (raw, isBinary) => {
        void (async () => {
          try {
            if (isBinary) {
              if (!sdk || !frame) throw new Error("Send a start control message before video frames");
              const packet = rawDataToBuffer(raw);
              if (packet.byteLength < 9) throw new Error("Binary frame is missing its 8-byte header");
              if (packet.byteLength > config.maxFrameBytes + 8) {
                throw new Error("Binary frame exceeds MAX_FRAME_BYTES");
              }

              const timestamp = packet.readBigUInt64BE(0);
              if (timestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
                throw new Error("Frame timestamp exceeds the JSON/JavaScript safe integer range");
              }
              const timestampUs = Number(timestamp);
              if (timestampUs <= lastTimestampUs) {
                throw new Error("Frame timestamps must be strictly increasing");
              }

              const pixels = packet.subarray(8);
              const expected = expectedFrameBytes(frame);
              if (pixels.byteLength !== expected) {
                throw new Error(`Expected ${expected} frame bytes, received ${pixels.byteLength}`);
              }

              lastTimestampUs = timestampUs;
              const accepted = sdk.sendFrame(
                pixels,
                frame.width,
                frame.height,
                frame.stride,
                frame.pixelFormat,
                timestampUs,
              );
              if (!accepted) send(socket, { type: "frame_rejected", timestampUs });
              return;
            }

            const text = rawDataToBuffer(raw).toString("utf8");
            if (text.length > 16_384) throw new Error("Control message exceeds 16 KiB");
            const message = JSON.parse(text) as Record<string, unknown>;

            if (message.type === "start") {
              if (sdk) throw new Error("Session has already started");
              const start = parseStartMessage(runtime, message);
              lease = coordinator.tryAcquire(sessionId);
              if (!lease) {
                send(socket, {
                  type: "error",
                  code: "SDK_BUSY",
                  message: "This instance is already processing a SmartSpectra session",
                  retryable: true,
                });
                socket.close(1013, "SmartSpectra SDK busy");
                return;
              }

              const requestedMetrics = start.requestedMetrics ?? allMetricCodes(runtime);
              sdk = runtime.create({
                apiKey: config.smartSpectraApiKey,
                requestedMetrics,
                enableAccumulatedOutput: true,
                logLevel: logLevelValue(config, runtime),
                enableTelemetry: config.enableTelemetry,
              });
              const currentSdk = sdk;
              lease.setCleanup(cleanup);
              wireSdkEvents(
                sdk,
                runtime,
                (event) => {
                  send(socket, event);
                  if (event.type === "sdk_error") {
                    clearSdkErrorCloseTimer();
                    request.log.error(
                      {
                        sessionId,
                        code: event.code,
                        name: event.name,
                        message: event.message,
                        retryable: event.retryable,
                      },
                      "SmartSpectra SDK error",
                    );
                    socket.close(1011, "SmartSpectra SDK error");
                    return;
                  }
                  if (
                    event.type === "processing_status" &&
                    event.status === runtime.processingStatus.kError
                  ) {
                    // The SDK normally emits its detailed error immediately after
                    // kError. Keep the socket open briefly so the client receives it.
                    closeAfterSdkErrorGracePeriod();
                  }
                },
                {
                  includeRawProtobuf: parseBoolean(request.query.includeRawProtobuf, true),
                  includeVideoOutput: parseBoolean(request.query.includeVideoOutput, false),
                },
              );

              const transform = enumValue(
                runtime.frameTransform,
                start.frameTransform,
                runtime.frameTransform.kNone,
              ) as FrameTransformValue;
              frame = start;
              try {
                sdk.useCustomInput(transform);
                sdk.start();
              } catch (error) {
                await cleanup();
                socket.close(1011, "SmartSpectra failed to start");
                throw error;
              }
              send(socket, {
                type: "session_started",
                sessionId,
                requestedMetrics,
                frame: {
                  width: frame.width,
                  height: frame.height,
                  stride: frame.stride,
                  pixelFormat: frame.pixelFormat,
                  pixelFormatName: enumName(runtime.pixelFormat, frame.pixelFormat),
                  expectedBytes: expectedFrameBytes(frame),
                },
              });
              return;
            }

            if (message.type === "insight") {
              if (!sdk) throw new Error("Session has not started");
              if (typeof message.prompt !== "string" || message.prompt.length === 0) {
                throw new Error("insight.prompt must be a non-empty string");
              }
              if (message.prompt.length > 4_000) throw new Error("insight.prompt exceeds 4,000 characters");
              const requestId = sdk.requestInsight(message.prompt);
              send(socket, { type: "insight_requested", requestId });
              return;
            }

            if (message.type === "stop") {
              await cleanup();
              send(socket, { type: "session_stopped", sessionId });
              socket.close(1000, "Session stopped");
              return;
            }

            throw new Error(`Unsupported control message type: ${String(message.type)}`);
          } catch (error) {
            const details = sdkErrorDetails(error);
            send(socket, {
              type: "error",
              code: details.code ?? "INVALID_MESSAGE",
              message: details.message,
              retryable: details.retryable,
            });
          }
        })();
      });

      socket.on("close", () => {
        void cleanup().catch((error) => {
          request.log.error({ err: error, sessionId }, "live session teardown failed");
        });
      });

      socket.on("error", (error) => {
        request.log.error({ err: error, sessionId }, "live WebSocket error");
      });
    },
  );
}
