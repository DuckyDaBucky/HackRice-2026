import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import type { AppConfig } from "../config.js";
import { errorBody, sdkErrorDetails } from "../errors.js";
import type { SessionCoordinator, SessionLease } from "../session-coordinator.js";
import type {
  FrameTransformValue,
  SdkRuntime,
  SdkSession,
  VideoFileOptions,
} from "../sdk/contracts.js";
import { allMetricCodes, enumName, type ApiEvent, wireSdkEvents } from "../sdk/events.js";

interface VideoQuery {
  stream?: string;
  includeRawProtobuf?: string;
  includeVideoOutput?: string;
  interframeDelayMs?: string;
  startOffsetMs?: string;
  maxDurationMs?: string;
  frameTransform?: string;
}

export interface VideoRouteDependencies {
  config: AppConfig;
  coordinator: SessionCoordinator;
  runtime: SdkRuntime;
}

function queryBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

function queryInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function resolveTransform(runtime: SdkRuntime, value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const direct = Number(value);
  if (Number.isInteger(direct) && Object.values(runtime.frameTransform).includes(direct)) {
    return direct;
  }

  const normalized = value.startsWith("k") ? value : `k${value}`;
  const entry = Object.entries(runtime.frameTransform).find(
    ([name]) => name.toLowerCase() === normalized.toLowerCase(),
  );
  if (!entry) throw new Error(`Unknown frameTransform: ${value}`);
  return entry[1];
}

function safeExtension(filename: string): string {
  const extension = extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : ".video";
}

async function teardown(sdk: SdkSession): Promise<void> {
  try {
    await sdk.stopAsync();
  } catch {
    // Destroy remains the authoritative cleanup operation after a failed stop.
  }
  await sdk.destroy();
}

export async function registerVideoAnalysisRoute(
  app: FastifyInstance,
  dependencies: VideoRouteDependencies,
): Promise<void> {
  const { config, coordinator, runtime } = dependencies;

  app.post<{ Querystring: VideoQuery }>("/v1/videos/analyze", async (request, reply) => {
    const analysisId = randomUUID();
    const uploadDirectory = join(tmpdir(), "presage-api-uploads");
    await mkdir(uploadDirectory, { recursive: true });

    let uploadPath: string | null = null;
    let lease: SessionLease | null = null;
    let sdk: SdkSession | null = null;
    let streaming = false;

    try {
      const part = await request.file({ limits: { fileSize: config.maxVideoBytes, files: 1 } });
      if (!part) {
        return reply
          .code(400)
          .send(errorBody("VIDEO_REQUIRED", "A multipart video file is required", false, request.id));
      }

      uploadPath = join(uploadDirectory, `${analysisId}${safeExtension(part.filename)}`);
      await pipeline(part.file, createWriteStream(uploadPath, { flags: "wx", mode: 0o600 }));
      if (part.file.truncated) {
        return reply
          .code(413)
          .send(errorBody("VIDEO_TOO_LARGE", "The uploaded video exceeds MAX_VIDEO_BYTES", false, request.id));
      }

      lease = coordinator.tryAcquire(analysisId);
      if (!lease) {
        return reply
          .code(409)
          .header("retry-after", "1")
          .send(
            errorBody(
              "SDK_BUSY",
              "This instance is already processing a SmartSpectra session",
              true,
              request.id,
            ),
          );
      }

      const requestedMetrics = allMetricCodes(runtime);
      const events: ApiEvent[] = [];
      const eventCounts = new Map<string, number>();
      streaming = queryBoolean(request.query.stream, false);
      if (streaming) {
        reply.hijack();
        reply.raw.writeHead(200, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-store",
          "x-request-id": request.id,
        });
        reply.raw.write(
          `${JSON.stringify({
            type: "analysis_started",
            emittedAt: new Date().toISOString(),
            analysisId,
            sdkVersion: runtime.sdkVersion,
            requestedMetrics,
          })}\n`,
        );
      }
      let resolveCompletion: (() => void) | undefined;
      let rejectCompletion: ((error: Error) => void) | undefined;
      const completion = new Promise<void>((resolve, reject) => {
        resolveCompletion = resolve;
        rejectCompletion = reject;
      });
      let hasRun = false;

      sdk = runtime.create({
        apiKey: config.smartSpectraApiKey,
        requestedMetrics,
        enableAccumulatedOutput: true,
        logLevel: runtime.logLevel[`k${config.logLevel[0]?.toUpperCase()}${config.logLevel.slice(1)}`] ?? 2,
        enableTelemetry: config.enableTelemetry,
      });

      const currentSdk = sdk;
      lease.setCleanup(() => teardown(currentSdk));
      wireSdkEvents(
        sdk,
        runtime,
        (event) => {
          eventCounts.set(event.type, (eventCounts.get(event.type) ?? 0) + 1);
          if (streaming) reply.raw.write(`${JSON.stringify(event)}\n`);
          else events.push(event);
          if (event.type === "processing_status") {
            const status = event.status as number;
            if (status === runtime.processingStatus.kRunning) hasRun = true;
            if (
              (hasRun && status === runtime.processingStatus.kIdle) ||
              status === runtime.processingStatus.kError
            ) {
              resolveCompletion?.();
            }
          }
          if (event.type === "sdk_error") {
            const sdkEventError = new Error(String(event.message));
            Object.assign(sdkEventError, { code: event.code, retryable: event.retryable });
            rejectCompletion?.(sdkEventError);
          }
        },
        {
          includeRawProtobuf: queryBoolean(request.query.includeRawProtobuf, true),
          includeVideoOutput: queryBoolean(request.query.includeVideoOutput, false),
        },
      );

      const transform = resolveTransform(runtime, request.query.frameTransform);
      const fileOptions: VideoFileOptions = {};
      const interframeDelayMs = queryInteger(request.query.interframeDelayMs, "interframeDelayMs");
      const startOffsetMs = queryInteger(request.query.startOffsetMs, "startOffsetMs");
      const maxDurationMs = queryInteger(request.query.maxDurationMs, "maxDurationMs");
      if (interframeDelayMs !== undefined) fileOptions.interframeDelayMs = interframeDelayMs;
      if (startOffsetMs !== undefined) fileOptions.startOffsetMs = startOffsetMs;
      if (maxDurationMs !== undefined) fileOptions.maxDurationMs = maxDurationMs;
      if (transform !== undefined) fileOptions.frameTransform = transform as FrameTransformValue;

      sdk.useFile(uploadPath, fileOptions);
      sdk.start();

      let timeout: NodeJS.Timeout | undefined;
      const timedCompletion = new Promise<void>((resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Video analysis timed out")),
          config.videoAnalysisTimeoutMs,
        );
        timeout.unref();
        completion.then(resolve, reject);
      });
      await timedCompletion.finally(() => {
        if (timeout) clearTimeout(timeout);
      });
      await teardown(sdk);
      sdk = null;
      lease.release();
      lease = null;

      const counts = Object.fromEntries(eventCounts);

      if (streaming) {
        reply.raw.end(
          `${JSON.stringify({
            type: "analysis_complete",
            emittedAt: new Date().toISOString(),
            analysisId,
            sdkVersion: runtime.sdkVersion,
            requestedMetrics,
            eventCounts: counts,
          })}\n`,
        );
        return reply;
      }

      return reply.send({
        analysisId,
        sdkVersion: runtime.sdkVersion,
        requestedMetrics,
        status: "completed",
        eventCounts: counts,
        events,
      });
    } catch (error) {
      request.log.error({ err: error, analysisId }, "video analysis failed");
      const details = sdkErrorDetails(error);
      const timedOut = details.message === "Video analysis timed out";
      const uploadTooLarge =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "FST_REQ_FILE_TOO_LARGE";
      if (streaming) {
        reply.raw.end(
          `${JSON.stringify({
            type: "analysis_failed",
            emittedAt: new Date().toISOString(),
            analysisId,
            error: {
              code: "VIDEO_ANALYSIS_FAILED",
              message: details.message,
              retryable: details.retryable,
            },
            sdk: {
              code: details.code,
              name: details.code === null ? null : enumName(runtime.errorCode, details.code),
            },
          })}\n`,
        );
        return reply;
      }
      return reply.code(uploadTooLarge ? 413 : timedOut ? 504 : 422).send({
        ...errorBody(
          uploadTooLarge ? "VIDEO_TOO_LARGE" : "VIDEO_ANALYSIS_FAILED",
          uploadTooLarge ? "The uploaded video exceeds MAX_VIDEO_BYTES" : details.message,
          uploadTooLarge ? false : details.retryable,
          request.id,
        ),
        sdk: {
          code: details.code,
          name: details.code === null ? null : enumName(runtime.errorCode, details.code),
        },
      });
    } finally {
      if (sdk) {
        try {
          await teardown(sdk);
        } catch (error) {
          request.log.error({ err: error, analysisId }, "SmartSpectra teardown failed");
        }
      }
      lease?.release();
      if (uploadPath) await rm(uploadPath, { force: true });
    }
  });
}
