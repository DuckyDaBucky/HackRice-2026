import "server-only";

/**
 * Modular LLM provider. All server-side text generation goes through here so
 * the model can be swapped without touching every call site.
 *
 * Providers:
 * - "meta" (default when MODEL_API_KEY is set): Muse Spark via Meta Model API,
 *   which is OpenAI-compatible. Key from https://dev.meta.ai, bearer auth,
 *   base URL https://api.meta.ai/v1, wire model id e.g. "muse-spark-1.3".
 * - "gemini" (legacy fallback): Google Generative Language REST API.
 *
 * Selection: explicit LLM_PROVIDER wins; otherwise MODEL_API_KEY present
 * implies meta, else gemini. No key for the active provider throws at call
 * time so pages can degrade to their local fallbacks.
 */

export type LlmProviderId = "meta" | "gemini";

export const META_BASE_URL = "https://api.meta.ai/v1";
export const META_DEFAULT_MODEL = "muse-spark-1.3-contributor";
export const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";

export function activeLlmProvider(): LlmProviderId {
  const explicit = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (explicit === "meta" || explicit === "gemini") return explicit;
  if (process.env.MODEL_API_KEY) return "meta";
  return "gemini";
}

/** Display model id for a purpose under the active (or given) provider. */
export function llmTextModel(
  purpose: "report" | "plan" | "agent" | "default" = "default",
  provider: LlmProviderId = activeLlmProvider(),
): string {
  if (provider === "meta") {
    return process.env.MIRA_MODEL || META_DEFAULT_MODEL;
  }
  if (purpose === "report") {
    return process.env.GEMINI_REPORT_MODEL || process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  }
  return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
}

export function llmBaseUrl(): string {
  return process.env.MIRA_BASE_URL || META_BASE_URL;
}

export function isLlmConfigured(provider: LlmProviderId = activeLlmProvider()): boolean {
  if (provider === "meta") return Boolean(process.env.MODEL_API_KEY);
  return Boolean(process.env.GEMINI_API_KEY);
}

export function describeLlm(): { provider: LlmProviderId; model: string; configured: boolean } {
  const provider = activeLlmProvider();
  return { provider, model: llmTextModel("default", provider), configured: isLlmConfigured(provider) };
}

export interface LlmCompletion {
  text: string;
  model: string;
  provider: LlmProviderId;
  usage: Record<string, number>;
}

function numericUsage(entries: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(entries).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

async function completeViaMeta(prompt: string, timeoutMs: number): Promise<LlmCompletion> {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) throw new Error("Muse Spark is not configured (set MODEL_API_KEY).");
  const model = llmTextModel("default", "meta");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${llmBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Muse Spark request failed with status ${response.status}. ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Muse Spark returned no text.");
    return {
      text,
      model,
      provider: "meta",
      usage: numericUsage({
        promptTokens: data.usage?.prompt_tokens,
        candidateTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function completeViaGemini(prompt: string, timeoutMs: number): Promise<LlmCompletion> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured (set GEMINI_API_KEY).");
  const model = llmTextModel("default", "gemini");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 128 },
          },
        }),
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}.`);
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: Record<string, unknown>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error("Gemini returned no text.");
    return {
      text,
      model,
      provider: "gemini",
      usage: numericUsage({
        promptTokens: data.usageMetadata?.promptTokenCount,
        candidateTokens: data.usageMetadata?.candidatesTokenCount,
        totalTokens: data.usageMetadata?.totalTokenCount,
      }),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * One JSON-mode completion through the active provider. Callers own prompt
 * building and response parsing/validation; provider-specific wire formats
 * stay inside this module.
 */
export async function completeJsonText(
  prompt: string,
  options?: { timeoutMs?: number; provider?: LlmProviderId },
): Promise<LlmCompletion> {
  const provider = options?.provider ?? activeLlmProvider();
  const timeoutMs = options?.timeoutMs ?? 25_000;
  if (provider === "meta") return completeViaMeta(prompt, timeoutMs);
  return completeViaGemini(prompt, timeoutMs);
}
