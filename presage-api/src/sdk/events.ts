import type { SdkRuntime, SdkSession } from "./contracts.js";

export interface ApiEvent {
  type: string;
  emittedAt: string;
  [key: string]: unknown;
}

export type EventSink = (event: ApiEvent) => void;

export interface EventWireOptions {
  includeRawProtobuf: boolean;
  includeVideoOutput: boolean;
}

export function allMetricCodes(runtime: SdkRuntime): number[] {
  return [
    ...new Set([
      ...runtime.metricBundles.breathing,
      ...runtime.metricBundles.cardio,
      ...runtime.metricBundles.face,
      ...runtime.metricBundles.micromotion,
      ...runtime.metricBundles.eda,
    ]),
  ];
}

export function enumName(values: Readonly<Record<string, number>>, value: number): string | null {
  return Object.entries(values).find(([, candidate]) => candidate === value)?.[0] ?? null;
}

function now(type: string, fields: Record<string, unknown> = {}): ApiEvent {
  return { type, emittedAt: new Date().toISOString(), ...fields };
}

function makeJsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(makeJsonSafe);
  if (typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") {
      return makeJsonSafe(value.toJSON());
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        makeJsonSafe(child),
      ]),
    );
  }
  return value;
}

function metricsEvent(
  type: "metrics" | "accumulated_metrics",
  buffer: Buffer,
  timestampUs: number,
  runtime: SdkRuntime,
  includeRawProtobuf: boolean,
): ApiEvent {
  let data: unknown = null;
  let decoderError: string | undefined;
  try {
    data = makeJsonSafe(runtime.decodeMetrics(buffer));
  } catch (error) {
    decoderError = error instanceof Error ? error.message : "Unknown metrics decoder error";
  }

  return now(type, {
    timestampUs,
    data,
    ...(includeRawProtobuf ? { protobufBase64: buffer.toString("base64") } : {}),
    ...(decoderError ? { decoderError } : {}),
  });
}

export function wireSdkEvents(
  sdk: SdkSession,
  runtime: SdkRuntime,
  sink: EventSink,
  options: EventWireOptions,
): void {
  sdk.on("processingStatus", (status) => {
    sink(
      now("processing_status", {
        status,
        name: enumName(runtime.processingStatus, status),
      }),
    );
  });

  sdk.on("validationStatus", (code, timestampUs, hint) => {
    sink(
      now("validation_status", {
        code,
        name: enumName(runtime.validationCode, code),
        timestampUs,
        hint,
      }),
    );
  });

  sdk.on("metrics", (buffer, timestampUs) => {
    sink(metricsEvent("metrics", buffer, timestampUs, runtime, options.includeRawProtobuf));
  });

  sdk.on("accumulatedMetrics", (buffer, timestampUs) => {
    sink(
      metricsEvent(
        "accumulated_metrics",
        buffer,
        timestampUs,
        runtime,
        options.includeRawProtobuf,
      ),
    );
  });

  sdk.on("insight", (buffer, requestId) => {
    sink(
      now("insight", {
        requestId,
        protobufBase64: buffer.toString("base64"),
      }),
    );
  });

  sdk.on("error", (code, message, retryable) => {
    sink(
      now("sdk_error", {
        code,
        name: enumName(runtime.errorCode, code),
        message,
        retryable,
      }),
    );
  });

  sdk.on("frameSentThrough", (sent, timestampUs) => {
    sink(now("frame_sent_through", { sent, timestampUs }));
  });

  sdk.on("videoOutput", (buffer, width, height, stride, pixelFormat, timestampUs) => {
    if (!options.includeVideoOutput) return;
    sink(
      now("video_output", {
        width,
        height,
        stride,
        pixelFormat,
        pixelFormatName: enumName(runtime.pixelFormat, pixelFormat),
        timestampUs,
        dataBase64: buffer.toString("base64"),
      }),
    );
  });
}
