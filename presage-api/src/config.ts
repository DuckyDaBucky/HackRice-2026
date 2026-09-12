export type LogLevelName = "debug" | "info" | "warning" | "error" | "none";

export interface AppConfig {
  host: string;
  port: number;
  smartSpectraApiKey: string;
  enableTelemetry: boolean;
  logLevel: LogLevelName;
  maxVideoBytes: number;
  videoAnalysisTimeoutMs: number;
  maxFrameBytes: number;
}

function integerFromEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  minimum: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function booleanFromEnv(env: NodeJS.ProcessEnv, name: string, fallback: boolean): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new Error(`${name} must be true, false, 1, or 0`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const smartSpectraApiKey = env.SMARTSPECTRA_API_KEY?.trim();
  if (!smartSpectraApiKey) throw new Error("SMARTSPECTRA_API_KEY is required");

  const logLevel = (env.SMARTSPECTRA_LOG_LEVEL ?? "warning").toLowerCase();
  if (!["debug", "info", "warning", "error", "none"].includes(logLevel)) {
    throw new Error("SMARTSPECTRA_LOG_LEVEL must be debug, info, warning, error, or none");
  }

  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: integerFromEnv(env, "PORT", 8080, 1),
    smartSpectraApiKey,
    enableTelemetry: booleanFromEnv(env, "SMARTSPECTRA_ENABLE_TELEMETRY", false),
    logLevel: logLevel as LogLevelName,
    maxVideoBytes: integerFromEnv(env, "MAX_VIDEO_BYTES", 1024 * 1024 * 1024, 1),
    videoAnalysisTimeoutMs: integerFromEnv(env, "VIDEO_ANALYSIS_TIMEOUT_MS", 21_600_000, 1),
    maxFrameBytes: integerFromEnv(env, "MAX_FRAME_BYTES", 16 * 1024 * 1024, 1024),
  };
}
