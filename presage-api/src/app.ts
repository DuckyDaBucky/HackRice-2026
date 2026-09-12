import { randomUUID } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";

import type { AppConfig } from "./config.js";
import { errorBody } from "./errors.js";
import { registerLiveRoute } from "./routes/live.js";
import { registerVideoAnalysisRoute } from "./routes/video-analysis.js";
import { SessionCoordinator } from "./session-coordinator.js";
import type { SdkRuntime } from "./sdk/contracts.js";
import { allMetricCodes } from "./sdk/events.js";

export interface AppDependencies {
  config: AppConfig;
  runtime: SdkRuntime;
  logger?: boolean;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const { config, runtime } = dependencies;
  const app = Fastify({
    logger: dependencies.logger ?? true,
    bodyLimit: config.maxVideoBytes,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });
  const coordinator = new SessionCoordinator();

  await app.register(websocket, {
    options: { maxPayload: config.maxFrameBytes + 8 },
  });
  await app.register(multipart, {
    limits: { fileSize: config.maxVideoBytes, files: 1, fields: 8, parts: 9 },
  });

  app.get("/health", async () => ({
    status: "ok",
    sdkVersion: runtime.sdkVersion,
    activeSessionId: coordinator.activeSessionId,
  }));

  app.get("/v1/capabilities", async () => ({
    sdkVersion: runtime.sdkVersion,
    concurrencyPerInstance: 1,
    endpoints: {
      liveWebSocket: "/v1/live",
      videoUpload: "/v1/videos/analyze",
    },
    metricBundles: runtime.metricBundles,
    metricTypes: runtime.metricTypes,
    defaultRequestedMetrics: allMetricCodes(runtime),
    enums: {
      processingStatus: runtime.processingStatus,
      validationCode: runtime.validationCode,
      errorCode: runtime.errorCode,
      pixelFormat: runtime.pixelFormat,
      frameTransform: runtime.frameTransform,
    },
    outputEvents: [
      "processing_status",
      "validation_status",
      "metrics",
      "accumulated_metrics",
      "insight",
      "sdk_error",
      "frame_sent_through",
      "video_output",
    ],
  }));

  await registerLiveRoute(app, { config, coordinator, runtime });
  await registerVideoAnalysisRoute(app, { config, coordinator, runtime });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "request failed");
    const caught = error as Error & { statusCode?: number };
    const statusCode = caught.statusCode && caught.statusCode >= 400 ? caught.statusCode : 500;
    const isClientError = statusCode < 500;
    void reply
      .code(statusCode)
      .send(
        errorBody(
          isClientError ? "INVALID_REQUEST" : "INTERNAL_ERROR",
          isClientError ? caught.message : "The service could not complete the request",
          statusCode >= 500,
          request.id,
        ),
      );
  });

  app.addHook("onClose", async () => {
    await coordinator.shutdown();
  });

  return app;
}
