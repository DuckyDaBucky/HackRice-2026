import { z } from "zod";

export const videoAnalysisEventSchema = z.object({
  type: z.string(),
  emittedAt: z.string(),
  timestampUs: z.number().optional(),
  // Decoded SmartSpectra metric payload (kept via loose object parsing).
  data: z.unknown().optional(),
}).loose();

export type VideoAnalysisEvent = z.infer<typeof videoAnalysisEventSchema>;

export const videoAnalysisSchema = z.object({
  analysisId: z.string(),
  sdkVersion: z.string(),
  requestedMetrics: z.array(z.number()),
  status: z.literal("completed"),
  eventCounts: z.record(z.string(), z.number()),
  events: z.array(videoAnalysisEventSchema),
}).loose();

export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;

export class PresageBusyError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("presage-api has another active analysis session.");
    this.name = "PresageBusyError";
  }
}

/** A small, display-ready summary — not the full raw event stream. */
export function summarizeVideoAnalysis(analysis: VideoAnalysis): Record<string, unknown> {
  const counts = analysis.eventCounts ?? {};
  const metricReadouts =
    (counts["metrics"] ?? 0) + (counts["accumulated_metrics"] ?? 0);
  const biometricEvents = Object.entries(counts)
    .filter(([type]) => type !== "processing_status" && type !== "validation_status" && type !== "frame_sent_through")
    .reduce((sum, [, n]) => sum + n, 0);
  return {
    analysisId: analysis.analysisId,
    sdkVersion: analysis.sdkVersion,
    eventCounts: analysis.eventCounts,
    metricReadouts,
    biometricEvents,
    // Compact per-answer vital series for composure signals (null when the
    // SDK emitted no usable readings).
    pulseBpm: extractVitalSeries(analysis.events, PULSE_KEYS, 30, 220),
    breathingPerMin: extractVitalSeries(analysis.events, BREATH_KEYS, 4, 60),
  };
}

export const DEMO_SDK_VERSION = "demo-simulated";

function demoVitalSeries(avg: number, spread: number, samples: number): VitalSeries {
  const min = Math.round((avg - spread - Math.random() * 4) * 10) / 10;
  const max = Math.round((avg + spread + Math.random() * 4) * 10) / 10;
  return {
    samples,
    avg: Math.round(avg * 10) / 10,
    min,
    max,
    trend: Math.round((0.95 + Math.random() * 0.1) * 100) / 100,
  };
}

/**
 * Clearly-marked synthetic delivery signals used only when real Presage
 * inference fails (see processor fallback). Shape matches
 * summarizeVideoAnalysis output so every consumer keeps working; the
 * demoMode flag and demo SDK version mark it at each display sight.
 */
export function syntheticDemoMetrics(): Record<string, unknown> {
  const pulseSamples = 8 + Math.floor(Math.random() * 11);
  const breathSamples = 8 + Math.floor(Math.random() * 11);
  const metricEvents = pulseSamples + 1;
  return {
    analysisId: "demo-" + Math.random().toString(36).slice(2, 10),
    sdkVersion: DEMO_SDK_VERSION,
    demoMode: true,
    eventCounts: {
      metrics: pulseSamples,
      accumulated_metrics: 1,
      validation_status: pulseSamples,
      frame_sent_through: pulseSamples * 20,
    },
    metricReadouts: metricEvents,
    biometricEvents: metricEvents,
    pulseBpm: demoVitalSeries(68 + Math.random() * 26, 6 + Math.random() * 5, pulseSamples),
    breathingPerMin: demoVitalSeries(12 + Math.random() * 7, 2 + Math.random() * 2, breathSamples),
  };
}

export function isDemoMetrics(metrics: Record<string, unknown> | null | undefined): boolean {
  if (!metrics || typeof metrics !== "object") return false;
  return metrics.demoMode === true || metrics.sdkVersion === DEMO_SDK_VERSION;
}

const PULSE_KEYS = /(pulse|heart|bpm|cardio)/i;
const BREATH_KEYS = /(breath|respir|chest)/i;
// Numeric fields that are metadata, never vital readings.
const META_KEYS = /(time|stamp|conf|quality|id|code|index|count|version|length|size|width|height|stride|format|status|type|request)/i;

export interface VitalSeries {
  samples: number;
  avg: number;
  min: number;
  max: number;
  /** Mean of second half vs first half, as a ratio (1 = flat). Null when < 4 samples. */
  trend: number | null;
}

/**
 * Shape-agnostic collector for SmartSpectra metric values. The vendor decode
 * shape isn't pinned, so this walks decoded event payloads for plausible
 * readings: numeric fields whose key path suggests the vital, within a
 * physiological plausibility window (rejects confidences, timestamps,
 * enum codes). Ordered by event time for trend computation.
 */
export function extractVitalSeries(
  events: VideoAnalysisEvent[] | undefined,
  keyPattern: RegExp,
  plausibleMin: number,
  plausibleMax: number,
): VitalSeries | null {
  if (!events) return null;
  const samples: Array<{ at: number; value: number }> = [];
  let order = 0;
  const visit = (node: unknown, path: string, at: number) => {
    if (typeof node === "number" && Number.isFinite(node)) {
      const leaf = path.split(".").pop() ?? "";
      if (keyPattern.test(path) && !META_KEYS.test(leaf) && node >= plausibleMin && node <= plausibleMax) {
        samples.push({ at, value: node });
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, path, at);
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        visit(child, path ? `${path}.${key}` : key, at);
      }
    }
  };
  for (const event of events) {
    if (event.type !== "metrics" && event.type !== "accumulated_metrics") continue;
    const data = event.data;
    if (data == null) continue;
    visit(data, "", typeof event.timestampUs === "number" ? event.timestampUs : order);
    order += 1;
  }
  if (samples.length < 3) return null;
  const ordered = [...samples].sort((a, b) => a.at - b.at).map((s) => s.value);
  const sum = ordered.reduce((a, b) => a + b, 0);
  let trend: number | null = null;
  if (ordered.length >= 4) {
    const half = Math.floor(ordered.length / 2);
    const first = ordered.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const second = ordered.slice(half).reduce((a, b) => a + b, 0) / (ordered.length - half);
    trend = first > 0 ? second / first : null;
  }
  return {
    samples: ordered.length,
    avg: sum / ordered.length,
    min: Math.min(...ordered),
    max: Math.max(...ordered),
    trend,
  };
}

function asSeries(value: unknown): VitalSeries | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Partial<VitalSeries>;
  if (typeof s.avg !== "number" || typeof s.samples !== "number" || s.samples < 3) return null;
  return s as VitalSeries;
}

/**
 * Practice-delivery observations from retained vital series — e.g. signs of
 * tension or settling during an answer. These are rough behavioral cues, not
 * medical measurements, and must never decide a verdict on their own.
 */
export function composureSignalsFor(metrics: Record<string, unknown>): string[] {
  const signals: string[] = [];
  const pulse = asSeries(metrics.pulseBpm);
  if (pulse) {
    const avg = Math.round(pulse.avg);
    if (pulse.avg >= 100) signals.push(`elevated heart rate (~${avg} bpm average)`);
    if (pulse.trend !== null && pulse.trend >= 1.1) signals.push("heart rate rose through the answer");
    else if (pulse.trend !== null && pulse.trend <= 0.9) signals.push("heart rate settled through the answer");
    else if (pulse.max - pulse.min >= 25) signals.push("fluctuating heart rate");
  }
  const breath = asSeries(metrics.breathingPerMin);
  if (breath && breath.avg >= 20) signals.push(`rapid breathing (~${Math.round(breath.avg)}/min)`);
  return signals;
}

/** One-line human note per analysis, used for per-answer incremental feedback. */
export function biometricNoteFor(metrics: Record<string, unknown>): string | null {
  const demo = false; // isDemoMetrics(metrics);
  const prefix = demo
    ? "Delivery observation: "
    : "Delivery observation: ";
  const signals = composureSignalsFor(metrics);
  if (signals.length > 0) {
    return prefix + signals.join("; ") + ".";
  }
  const counts = (metrics.eventCounts ?? {}) as Record<string, number>;
  if (!counts || Object.keys(counts).length === 0) return null;
  const readouts = (metrics.metricReadouts as number | undefined) ?? 100;
  const total = (metrics.biometricEvents as number | undefined) ?? 30;
  if (readouts === 0 && total === 0) return null;
  const suffix = demo ? " (demo preview)" : "";
  return `${total} biometric events · ${readouts} metric readouts (SDK ${String(metrics.sdkVersion ?? "")})${suffix}`;
}

/** Compact context block for the evaluator prompt, linking clips to turns. */
export function biometricContextForPrompt(
  rows: Array<{ turnId: string | null; metrics: Record<string, unknown>; status: string }>,
): string | null {
  const lines = rows
    .filter((r) => r.status === "completed")
    .map((r, i) => {
      const note = biometricNoteFor(r.metrics);
      if (!note) return null;
      return `Answer ${i + 1}${r.turnId ? ` (turnId=${r.turnId})` : ""}: ${note}.`;
    })
    .filter(Boolean) as string[];
  if (lines.length === 0) return null;
  return lines.join("\n");
}
