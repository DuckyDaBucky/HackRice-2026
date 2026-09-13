import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeLlmProvider,
  completeJsonText,
  describeLlm,
  llmTextModel,
} from "../src/lib/llm/provider";

const ENV_KEYS = ["LLM_PROVIDER", "MODEL_API_KEY", "MIRA_MODEL", "MIRA_BASE_URL", "GEMINI_API_KEY", "GEMINI_MODEL", "GEMINI_REPORT_MODEL"] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  setEnv({ LLM_PROVIDER: undefined, MODEL_API_KEY: undefined, MIRA_MODEL: undefined, MIRA_BASE_URL: undefined, GEMINI_API_KEY: undefined, GEMINI_MODEL: undefined, GEMINI_REPORT_MODEL: undefined });
});

describe("activeLlmProvider", () => {
  it("prefers an explicit LLM_PROVIDER", () => {
    setEnv({ LLM_PROVIDER: "gemini", MODEL_API_KEY: "meta-key" });
    expect(activeLlmProvider()).toBe("gemini");
  });

  it("defaults to meta when MODEL_API_KEY is set", () => {
    setEnv({ MODEL_API_KEY: "meta-key" });
    expect(activeLlmProvider()).toBe("meta");
  });

  it("falls back to gemini without a meta key", () => {
    setEnv({});
    expect(activeLlmProvider()).toBe("gemini");
  });
});

describe("llmTextModel", () => {
  it("uses muse-spark-1.3-contributor by default for meta", () => {
    setEnv({ MODEL_API_KEY: "meta-key" });
    expect(llmTextModel("report")).toBe("muse-spark-1.3-contributor");
  });

  it("honors MIRA_MODEL", () => {
    setEnv({ MODEL_API_KEY: "meta-key", MIRA_MODEL: "muse-spark-1.2" });
    expect(llmTextModel()).toBe("muse-spark-1.2");
  });

  it("keeps the gemini report-model override chain", () => {
    setEnv({ GEMINI_API_KEY: "g", GEMINI_MODEL: "gemini-x", GEMINI_REPORT_MODEL: "gemini-report" });
    expect(llmTextModel("report", "gemini")).toBe("gemini-report");
    expect(llmTextModel("plan", "gemini")).toBe("gemini-x");
  });
});

describe("completeJsonText via meta", () => {
  it("posts OpenAI-compatible chat completions with bearer auth", async () => {
    setEnv({ MODEL_API_KEY: "meta-key" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeJsonText('Return {"ok":true}', { timeoutMs: 5_000 });
    expect(result.text).toBe('{"ok":true}');
    expect(result.provider).toBe("meta");
    expect(result.model).toBe("muse-spark-1.3-contributor");
    expect(result.usage).toEqual({ promptTokens: 10, candidateTokens: 3, totalTokens: 13 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer meta-key");
    const body = JSON.parse(init.body as string) as { model: string; response_format: { type: string } };
    expect(body.model).toBe("muse-spark-1.3-contributor");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("throws a status-tagged error on failure", async () => {
    setEnv({ MODEL_API_KEY: "meta-key" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("overloaded", { status: 429 })));
    await expect(completeJsonText("hi", { timeoutMs: 5_000 })).rejects.toThrow(/status 429/);
  });
});

describe("completeJsonText via gemini", () => {
  it("posts to the generative-language endpoint", async () => {
    setEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "g-key", GEMINI_MODEL: "gemini-3.6-flash" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeJsonText('Return {"ok":true}', { timeoutMs: 5_000 });
    expect(result.provider).toBe("gemini");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("generativelanguage.googleapis.com");
    expect(url).toContain("key=g-key");
  });
});

describe("describeLlm", () => {
  it("reports provider, model and configured state", () => {
    setEnv({ MODEL_API_KEY: "meta-key" });
    expect(describeLlm()).toEqual({ provider: "meta", model: "muse-spark-1.3-contributor", configured: true });
  });
});
