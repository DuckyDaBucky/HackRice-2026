import type { AgentContext, AgentDecision } from "./agent-contracts";

export function fallbackAgentDecision(context: AgentContext, reason: "provider_fallback" | "time_budget_reached" = "provider_fallback"): AgentDecision {
  if (reason === "time_budget_reached" || context.isLastQuestion) {
    return { action: "close_interview", rationale: reason === "time_budget_reached" ? "time_budget_reached" : "coverage_complete" };
  }
  return { action: "move_to_next_question", rationale: "provider_fallback" };
}

/** Enforces interview invariants independently of the model response. */
export function validateAgentDecision(context: AgentContext, candidate: AgentDecision): AgentDecision {
  if (context.elapsedActiveMs >= context.timeBudgetSeconds * 1_000) {
    return fallbackAgentDecision(context, "time_budget_reached");
  }
  if (candidate.action === "ask_follow_up") {
    if (context.followUpsUsed >= context.maxFollowUps) return fallbackAgentDecision(context);
    return candidate;
  }
  if (candidate.action === "move_to_next_question" && context.isLastQuestion) {
    return { action: "close_interview", rationale: "coverage_complete" };
  }
  return candidate;
}
