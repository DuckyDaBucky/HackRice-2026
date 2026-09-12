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

const PLAN_PROMPT_VERSION = "interview-plan-v1";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
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

  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
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
