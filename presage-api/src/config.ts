export type LogLevelName = "debug" | "info" | "warning" | "error" | "none";

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  keyPrefix: string;
}

export interface AppConfig {
  host: string;
  port: number;
  smartSpectraApiKey: string;
  enableTelemetry: boolean;
  logLevel: LogLevelName;
  maxVideoBytes: number;
  videoAnalysisTimeoutMs: number;
  maxFrameBytes: number;
  r2?: R2Config | undefined;
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
    r2: r2ConfigFromEnv(env),
  };
}

function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function r2ConfigFromEnv(env: NodeJS.ProcessEnv): R2Config | undefined {
  const accountId = optionalEnv(env, "R2_ACCOUNT_ID");
  const accessKeyId = optionalEnv(env, "R2_ACCESS_KEY_ID");
  const secretAccessKey = optionalEnv(env, "R2_SECRET_ACCESS_KEY");
  const bucket = optionalEnv(env, "R2_BUCKET");
  const present = [accountId, accessKeyId, secretAccessKey, bucket].filter(
    (value) => value !== undefined,
  ).length;
  if (present === 0) return undefined;
  if (present < 4 || !accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 configuration is incomplete: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET together",
    );
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    keyPrefix: optionalEnv(env, "R2_KEY_PREFIX") ?? "",
  };
}
