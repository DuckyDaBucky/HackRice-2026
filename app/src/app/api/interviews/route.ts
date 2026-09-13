import { auth } from "@clerk/nextjs/server";
import { interviewSetupSchema } from "@/lib/interviews/contracts";
import {
  createFallbackInterviewPlan,
  generateInterviewPlan,
  planInputHash,
} from "@/lib/interviews/planner";
import {
  beginSessionPlanning,
  completeSessionPlan,
  failSessionPlanning,
} from "@/lib/interviews/persistence";
import { llmTextModel } from "@/lib/llm/provider";

const PLAN_PROMPT_VERSION = "interview-plan-v1";

function candidateOrigins(request: Request): Set<string> {
  const candidates = new Set<string>([new URL(request.url).origin]);
  // Proxied deployments (nginx, tunnels): the public host arrives via
  // x-forwarded-host while request.url may carry the internal host.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    candidates.add(`${forwardedProto}://${forwardedHost}`);
  }
  // Localhost aliases: localhost, 127.0.0.1 and ::1 all reach this server.
  for (const candidate of [...candidates]) {
    try {
      const url = new URL(candidate);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
        candidates.add(`${url.protocol}//localhost:${url.port}`);
        candidates.add(`${url.protocol}//127.0.0.1:${url.port}`);
        candidates.add(`${url.protocol}//[::1]:${url.port}`);
      }
    } catch {
      // Ignore malformed candidates; the strict comparison below still applies.
    }
  }
  // Explicit allowlist for preview/tunnel deployments.
  for (const extra of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = extra.trim();
    if (trimmed) candidates.add(trimmed);
  }
  return candidates;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const ok = candidateOrigins(request).has(parsed.origin);
  if (!ok) {
    console.warn("Rejected cross-origin interview setup", {
      origin: parsed.origin,
      requestOrigin: new URL(request.url).origin,
    });
  }
  return ok;
}

/** Creates a durable plan before the candidate ever reaches the interview lobby. */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Sign in to create an interview." }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = interviewSetupSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid interview setup." }, { status: 400 });

  const model = llmTextModel("plan");
  const inputHash = planInputHash(parsed.data);
  let draft: Awaited<ReturnType<typeof beginSessionPlanning>>;
  try {
    draft = await beginSessionPlanning({
      clerkUserId: userId,
      setup: parsed.data,
      model,
      promptVersion: PLAN_PROMPT_VERSION,
      inputHash,
      inputSummary: {
        contentTypes: parsed.data.contentTypes,
        seniority: parsed.data.seniority,
        timeBudgetSeconds: parsed.data.timeBudgetSeconds,
      },
    });
  } catch (error) {
    console.error("Could not create interview planning draft", error);
    return Response.json({ error: "Could not create the interview session." }, { status: 500 });
  }

  try {
    const plan = await generateInterviewPlan(parsed.data);
    await completeSessionPlan({
      sessionId: draft.sessionId,
      generationId: draft.generationId,
      questions: plan.questions,
      result: plan.result,
      usage: plan.usage,
      model: plan.model,
    });
    return Response.json({ sessionId: draft.sessionId, planSource: plan.source }, { status: 201 });
  } catch (error) {
    console.error("Could not generate interview plan", error);
    const fallback = createFallbackInterviewPlan(parsed.data);
    try {
      await completeSessionPlan({
        sessionId: draft.sessionId,
        generationId: draft.generationId,
        questions: fallback.questions,
        result: {
          ...fallback.result,
          providerError: error instanceof Error ? error.name : "PLANNER_FAILED",
        },
        usage: fallback.usage,
        model: fallback.model,
      });
      return Response.json({ sessionId: draft.sessionId, planSource: "fallback" }, { status: 201 });
    } catch (fallbackError) {
      console.error("Could not persist fallback interview plan", fallbackError);
      await failSessionPlanning({
        sessionId: draft.sessionId,
        generationId: draft.generationId,
        errorCode: error instanceof Error ? error.name : "PLANNER_FAILED",
      }).catch(() => {});
      return Response.json({ error: "Could not create an interview plan. Please try again." }, { status: 502 });
    }
  }
}
