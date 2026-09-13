import type { ApprovedQuestion } from "./contracts";

export interface PlanQuestionRef {
  id: string;
  position: number;
  prompt: string;
}

export interface ReportItemRef {
  planQuestionId?: string | null;
  competency?: unknown;
  coverage?: unknown;
  finding?: unknown;
  rating?: unknown;
  evidenceText?: unknown;
}

export interface AnswerGuideEntry {
  position: number;
  prompt: string;
  competency: string;
  intent: string | null;
  indicators: string[];
  finding: string | null;
  rating: number | null;
  coverage: string | null;
}

/**
 * Joins the approved pack (what HR expected), the frozen plan (what ran),
 * and the evaluation items (what happened) into per-question overlay
 * entries. Matching is positional: the plan is built from the pack in
 * position order. Anything unmatchable is skipped, never fabricated.
 */
export function buildAnswerGuide(
  packQuestions: ApprovedQuestion[],
  planQuestions: PlanQuestionRef[],
  items: ReportItemRef[],
): AnswerGuideEntry[] {
  const byPosition = new Map(packQuestions.map((q) => [q.position, q]));
  const itemsByPlan = new Map<string, ReportItemRef[]>();
  for (const item of items) {
    if (!item.planQuestionId) continue;
    const list = itemsByPlan.get(item.planQuestionId) ?? [];
    list.push(item);
    itemsByPlan.set(item.planQuestionId, list);
  }

  const entries: AnswerGuideEntry[] = [];
  for (const plan of [...planQuestions].sort((a, b) => a.position - b.position)) {
    const pack = byPosition.get(plan.position);
    const related = itemsByPlan.get(plan.id) ?? [];
    // Prefer a rated dimension; otherwise show the first observation.
    const primary = related.find((i) => typeof i.rating === "number") ?? related[0] ?? null;
    entries.push({
      position: plan.position,
      prompt: plan.prompt,
      competency: pack?.competency ?? "",
      intent: pack?.intent ?? null,
      indicators: pack?.strongAnswerIndicators ?? [],
      finding: typeof primary?.finding === "string" ? primary.finding : null,
      rating: typeof primary?.rating === "number" ? primary.rating : null,
      coverage: typeof primary?.coverage === "string" ? primary.coverage : null,
    });
  }
  return entries;
}
