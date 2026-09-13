import { NextResponse } from "next/server";

function presageBaseUrl(): string {
  if (process.env.PRESAGE_API_URL) return process.env.PRESAGE_API_URL.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "http://presage-api:8080" : "http://localhost:8181";
}

interface CachedCapabilities {
  at: number;
  sdkVersion: string | null;
  metricCount: number | null;
}

let capabilitiesCache: CachedCapabilities | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchJson(url: string, timeoutMs: number): Promise<{ ok: boolean; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return { ok: false, data: null };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(timeout);
  }
}

function countMetrics(data: {
  metricTypes?: unknown;
  metricBundles?: unknown;
  defaultRequestedMetrics?: unknown;
}): number | null {
  if (data.metricTypes && typeof data.metricTypes === "object") {
    return Object.keys(data.metricTypes).length;
  }
  if (data.metricBundles && typeof data.metricBundles === "object") {
    let total: number | null = null;
    for (const bundle of Object.values(data.metricBundles as Record<string, unknown>)) {
      if (Array.isArray(bundle)) total = (total ?? 0) + bundle.length;
    }
    if (total !== null) return total;
  }
  if (Array.isArray(data.defaultRequestedMetrics)) return data.defaultRequestedMetrics.length;
  return null;
}

/**
 * Authenticated-gateway status for the vendor-keyed presage-api service
 * (see presage-api/README.md and openapi.yaml). Exposes reachability, the
 * runtime SDK version, the native session slot, and the metric count so the
 * interview UI and LLM prompts can describe what the camera pipeline sees.
 * Never exposes the SmartSpectra API key, which stays in presage-api.
 */
export async function GET() {
  const base = presageBaseUrl();
  const health = await fetchJson(`${base}/health`, 5_000);
  const healthData = (health.data ?? {}) as { sdkVersion?: unknown; activeSessionId?: unknown };
  let capabilities = capabilitiesCache;
  if (!capabilities || Date.now() - capabilities.at > CACHE_TTL_MS) {
    const result = await fetchJson(`${base}/v1/capabilities`, 8_000);
    const data = (result.data ?? {}) as {
      sdkVersion?: unknown;
      metricTypes?: unknown;
      metricBundles?: unknown;
      defaultRequestedMetrics?: unknown;
    };
    capabilities = {
      at: Date.now(),
      sdkVersion: typeof data.sdkVersion === "string" ? data.sdkVersion : null,
      metricCount: countMetrics(data),
    };
    if (result.ok) capabilitiesCache = capabilities;
  }
  const activeSessionId =
    typeof healthData.activeSessionId === "string" && healthData.activeSessionId.length > 0
      ? healthData.activeSessionId
      : null;
  return NextResponse.json({
    reachable: health.ok,
    sdkVersion:
      typeof healthData.sdkVersion === "string" ? healthData.sdkVersion : capabilities.sdkVersion,
    sessionActive: activeSessionId !== null,
    activeSessionId,
    metricCount: capabilities.metricCount,
  });
}
