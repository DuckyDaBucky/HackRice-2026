"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, FileTextIcon } from "@phosphor-icons/react";
import type { ProcessMistake } from "@/lib/analytics/process-events";
import type { ReportOverview } from "@/lib/reports/contracts";
import { REPORT_VERDICT_SCORES, reportScoreFromVerdicts } from "@/lib/reports/scoring";
import type { ReviewAnswer, SessionReview } from "@/lib/reports/timeline";
import { formatDuration } from "@/lib/recording/format-duration";
import { AnswerVideo } from "@/components/reports/AnswerVideo";

interface VerdictMeta {
  label: string;
  glyph: string;
  color: string;
  score: number | null;
}

// Status palette (good / warning / serious / critical): color never carries a verdict alone — the
// chess glyph and text label always ride with it, and the graph encodes quality by position.
const VERDICTS: Record<string, VerdictMeta> = {
  best: { label: "Best", glyph: "!!", color: "#0ca30c", score: REPORT_VERDICT_SCORES.best },
  good: { label: "Good", glyph: "!", color: "#0ca30c", score: REPORT_VERDICT_SCORES.good },
  inaccuracy: { label: "Inaccuracy", glyph: "?!", color: "#fab219", score: REPORT_VERDICT_SCORES.inaccuracy },
  mistake: { label: "Mistake", glyph: "?", color: "#ec835a", score: REPORT_VERDICT_SCORES.mistake },
  blunder: { label: "Blunder", glyph: "??", color: "#d03b3b", score: REPORT_VERDICT_SCORES.blunder },
  insufficient_evidence: { label: "Insufficient evidence", glyph: "–", color: "#898781", score: REPORT_VERDICT_SCORES.insufficient_evidence },
};
const NOT_REVIEWED: VerdictMeta = { label: "Not reviewed", glyph: "·", color: "#52514e", score: null };
const SUMMARY_ORDER = ["best", "good", "inaccuracy", "mistake", "blunder", "insufficient_evidence"];

const CHART = {
  surface: "var(--dash-surface)",
  grid: "var(--dash-border)",
  axis: "var(--dash-border-strong)",
  muted: "var(--dash-text-faint)",
  line: "var(--color-accent-deep)",
};
const GRAPH = { width: 640, height: 200, left: 40, right: 16, top: 16, bottom: 30 };

const PROCESS_MISTAKE_LABEL: Record<ProcessMistake["kind"], string> = {
  skipped_question: "Skipped question",
  time_overrun: "Over time",
  upload_failed: "Upload failed",
};

const EMPTY_REPORT_NEXT_STEPS = [
  ["Submit every answer", "Even a short, specific response gives the reviewer evidence to coach."],
  ["Use a simple structure", "State the situation, your action, and the measurable result."],
  ["Keep recording enabled", "Recordings unlock playback, captions, and optional delivery signals."],
] as const;

function verdictOf(answer: ReviewAnswer): VerdictMeta {
  return answer.finding ? VERDICTS[answer.finding.verdict] ?? NOT_REVIEWED : NOT_REVIEWED;
}

/** Ink or white, whichever reads on the fill — the one case text sits inside a colored mark. */
function inkOn(hex: string) {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.179 ? "#0b0b0b" : "#ffffff";
}

function VerdictGlyph({ meta, size = "md" }: { meta: VerdictMeta; size?: "sm" | "md" }) {
  const dimension = size === "sm" ? "h-5 min-w-5 text-[10px]" : "h-6 min-w-6 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full px-1 font-bold ${dimension}`}
      style={{ backgroundColor: meta.color, color: inkOn(meta.color) }}
    >
      {meta.glyph}
    </span>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-surface p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-dash-text">{title}</h2>
        {hint && <span className="text-xs text-dash-text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function StepButton({ label, disabled, onClick, children }: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-dash-text-muted transition hover:bg-dash-surface-muted focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function AnswerDetail({ answer, total, answers, selected, sessionId, onStep, onSelect }: {
  answer: ReviewAnswer;
  total: number;
  answers: ReviewAnswer[];
  selected: number;
  sessionId: string | null;
  onStep: (delta: number) => void;
  onSelect: (index: number) => void;
}) {
  const meta = verdictOf(answer);
  const timed = answers.some((a) => a.clip?.durationMs);
  const weights = answers.map((a) => a.clip?.durationMs ?? 1);
  const weightTotal = weights.reduce((s, w) => s + w, 0) || 1;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-dash-border bg-dash-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-dash-text-muted">
          <span>
            Answer {answer.number} of {total}
          </span>
          {answer.isFollowUp && (
            <span className="rounded-md bg-dash-surface-muted px-2 py-0.5 text-xs text-dash-text-muted">Follow-up</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <StepButton label="Previous answer" disabled={answer.number === 1} onClick={() => onStep(-1)}>
            ←
          </StepButton>
          <StepButton label="Next answer" disabled={answer.number === total} onClick={() => onStep(1)}>
            →
          </StepButton>
        </div>
      </div>

      {sessionId ? (
        <AnswerVideo
          sessionId={sessionId}
          artifactId={answer.artifactId}
          initialUrl={answer.clip?.url ?? null}
          turnId={answer.turnId}
        />
      ) : answer.clip ? (
        <video
          key={answer.turnId}
          src={answer.clip.url}
          controls
          preload="metadata"
          playsInline
          className="aspect-video w-full rounded-xl bg-black"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-dash-surface-muted text-sm text-dash-text-muted">
          No recording was saved for this answer
        </div>
      )}

      {/* Answer accuracy mapped onto the video position: session chapters colored by verdict. */}
      <div
        role="group"
        aria-label="Answer accuracy chapters for this interview"
        className="flex h-6 gap-[2px]"
      >
        {answers.map((item, index) => {
          const itemMeta = verdictOf(item);
          const isCurrent = index === selected;
          return (
            <button
              key={item.turnId}
              type="button"
              title={`Answer ${item.number}: ${itemMeta.label}${itemMeta.score === null ? "" : ` (${itemMeta.score})`}${item.finding ? ` — ${item.finding.explanation}` : ""}`}
              aria-label={`Answer ${item.number}: ${itemMeta.label}${item.finding ? `. ${item.finding.explanation}` : ""}`}
              aria-current={isCurrent ? "true" : undefined}
              onClick={() => onSelect(index)}
              style={{
                flexGrow: timed ? weights[index] : 1,
                flexBasis: 0,
                backgroundColor: itemMeta.color,
                color: inkOn(itemMeta.color),
              }}
              className={`min-w-6 rounded text-[10px] font-bold transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-accent ${isCurrent ? "outline-2 outline-offset-2 outline-dash-text" : "opacity-80"}`}
            >
              {weights[index] / weightTotal >= 0.06 ? itemMeta.glyph : <span aria-hidden="true">·</span>}
            </button>
          );
        })}
      </div>

      {answer.question && <h2 className="text-base font-semibold text-dash-text">{answer.question}</h2>}

      <div className="flex flex-col gap-2 rounded-lg bg-dash-surface-muted p-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-dash-text">
          <VerdictGlyph meta={meta} />
          {meta.label}
        </span>
        {answer.finding ? (
          <>
            <p className="text-sm leading-relaxed text-dash-text-muted">
              <span className="text-dash-text-faint">Why: </span>
              {answer.finding.explanation}
            </p>
            {answer.finding.improvement && (
              <p className="text-sm leading-relaxed text-dash-text-muted">
                <span className="text-dash-text-faint">Try instead: </span>
                {answer.finding.improvement}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-dash-text-muted">Generate the review to get a verdict for this answer.</p>
        )}
      </div>

      {answer.transcript && (
        <details className="text-sm">
          <summary className="cursor-pointer text-dash-text-muted hover:text-dash-text">Transcript</summary>
          <p className="mt-2 leading-relaxed text-dash-text-muted">{answer.transcript}</p>
        </details>
      )}
    </section>
  );
}

function SessionTimelineStrip({ answers, selected, onSelect }: {
  answers: ReviewAnswer[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Stable widths: use real durations where present, fall back to equal slices
  // for missing clips instead of collapsing the whole strip to equal weights.
  const weights = answers.map((answer) =>
    answer.clip?.durationMs && answer.clip.durationMs > 0 ? (answer.clip.durationMs as number) : null,
  );
  const knownTotal: number = weights.reduce<number>((sum, w) => sum + (w ?? 0), 0);
  const missing = weights.filter((w) => w === null).length;
  const fallbackWeight = missing > 0 ? Math.max(knownTotal / Math.max(1, answers.length - missing), 15_000) : 1;
  const resolved = weights.map((w) => w ?? fallbackWeight);
  const total = resolved.reduce((sum, weight) => sum + weight, 0) || 1;
  const hasAnyDuration = weights.some((w) => w !== null);
  const starts = resolved.map((_, index) => resolved.slice(0, index).reduce((sum, weight) => sum + weight, 0));
  const hoveredAnswer = hovered === null ? null : answers[hovered];
  const hoveredMeta = hoveredAnswer ? verdictOf(hoveredAnswer) : null;
  // Clamp tooltip so it never overflows the card at the edges.
  const hoverPct = hovered === null ? 0 : ((starts[hovered] + resolved[hovered] / 2) / total) * 100;
  const clampedPct = Math.min(82, Math.max(18, hoverPct));

  return (
    <Card title="Interview timeline" hint={hasAnyDuration ? "Width shows how long each answer ran" : "Answers in order"}>
      <div className="relative">
        {hoveredAnswer && hovered !== null && hoveredMeta && (
          <div
            role="status"
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-lg"
            style={{ left: `${clampedPct}%` }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
              <VerdictGlyph meta={hoveredMeta} size="sm" />
              {hoveredMeta.label}
              {hoveredMeta.score !== null && <span className="text-zinc-400 tabular-nums">· {hoveredMeta.score}</span>}
            </p>
            <p className="mt-0.5 text-zinc-400">
              Answer {hoveredAnswer.number}
              {hoveredAnswer.clip?.durationMs ? ` · ${formatDuration(hoveredAnswer.clip.durationMs)}` : ""}
            </p>
            {hoveredAnswer.finding ? (
              <p className="mt-1 leading-relaxed text-zinc-300 normal-case">
                <span className="text-zinc-500">Why: </span>
                {hoveredAnswer.finding.explanation}
              </p>
            ) : (
              <p className="mt-1 text-zinc-500">Not reviewed yet.</p>
            )}
          </div>
        )}
        <div className="flex h-9 gap-[2px]" role="listbox" aria-label="Answers in order">
          {answers.map((answer, index) => {
            const meta = verdictOf(answer);
            const isSelected = index === selected;
            return (
              <button
                key={answer.turnId}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-label={`Answer ${answer.number}: ${meta.label}${answer.finding ? `. ${answer.finding.explanation}` : ". Not reviewed"}`}
                title={answer.finding ? `Answer ${answer.number} — ${meta.label}: ${answer.finding.explanation}` : `Answer ${answer.number} — ${meta.label}`}
                onClick={() => onSelect(index)}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                style={{ flexGrow: resolved[index], flexBasis: 0, backgroundColor: meta.color, color: inkOn(meta.color) }}
                className={`min-w-3 text-xs font-bold transition first:rounded-l-[4px] last:rounded-r-[4px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${isSelected ? "outline-2 outline-offset-2 outline-zinc-100" : ""}`}
              >
                {resolved[index] / total >= 0.06 ? meta.glyph : <span aria-hidden="true" className="opacity-70">·</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-dash-text-faint tabular-nums">
          <span>{hasAnyDuration ? "0:00" : "Start"}</span>
          <span>{hasAnyDuration ? formatDuration(total) : "End"}</span>
        </div>
      </div>
    </Card>
  );
}

function EvaluationGraph({ answers, selected, onSelect }: {
  answers: ReviewAnswer[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const plotWidth = GRAPH.width - GRAPH.left - GRAPH.right;
  const plotHeight = GRAPH.height - GRAPH.top - GRAPH.bottom;
  const xFor = (index: number) =>
    GRAPH.left + (answers.length === 1 ? plotWidth / 2 : (index / (answers.length - 1)) * plotWidth);
  const yFor = (score: number) => GRAPH.top + (1 - score / 100) * plotHeight;
  const baseline = yFor(0);

  const points = answers.map((answer, index) => {
    const meta = verdictOf(answer);
    return { index, meta, x: xFor(index), y: meta.score === null ? null : yFor(meta.score) };
  });

  // Break the line wherever an answer wasn't scored so a gap never reads as a trend.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (point.y === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ x: point.x, y: point.y });
    }
  }
  if (run.length) runs.push(run);

  if (runs.length === 0) {
    return (
      <Card title="Answer quality across the interview">
        <p className="py-6 text-center text-sm text-dash-text-muted">The quality graph appears once answers are reviewed.</p>
      </Card>
    );
  }

  const nearestIndex = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * GRAPH.width;
    return points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(points[best].x - x) ? point.index : best), 0);
  };
  const hoveredPoint = hovered === null ? null : points[hovered];
  const hoveredAnswer = hovered === null ? null : answers[hovered];
  const hoverLeftPct = hoveredPoint ? Math.min(80, Math.max(20, (hoveredPoint.x / GRAPH.width) * 100)) : 50;

  return (
    <Card title="Answer accuracy across the interview" hint="Hover for why · click a point to review that answer">
      <div className="relative">
        <svg
          viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label="Answer accuracy score by answer number, from 0 (blunder) to 100 (best)"
          onPointerMove={(event) => setHovered(nearestIndex(event))}
          onPointerLeave={() => setHovered(null)}
          onClick={(event) => onSelect(nearestIndex(event as unknown as ReactPointerEvent<SVGSVGElement>))}
        >
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={GRAPH.left}
                x2={GRAPH.width - GRAPH.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke={tick === 0 ? CHART.axis : CHART.grid}
                strokeWidth={1}
              />
              <text x={GRAPH.left - 8} y={yFor(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill={CHART.muted}>
                {tick}
              </text>
            </g>
          ))}

          {runs.map((segment, index) => (
            <g key={index}>
              {segment.length > 1 && (
                <path
                  d={`M${segment[0].x},${baseline} ${segment.map((point) => `L${point.x},${point.y}`).join(" ")} L${segment[segment.length - 1].x},${baseline} Z`}
                  fill={CHART.line}
                  fillOpacity={0.1}
                />
              )}
              <polyline
                points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke={CHART.line}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {hoveredPoint && (
            <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={GRAPH.top} y2={baseline} stroke={CHART.muted} strokeWidth={1} />
          )}

          {points.map((point) => {
            const isSelected = point.index === selected;
            return (
              <g key={point.index}>
                {point.y !== null && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isSelected ? 7 : 5}
                    fill={point.meta.color}
                    stroke={isSelected ? "#fafafa" : CHART.surface}
                    strokeWidth={2}
                  />
                )}
                <text
                  x={point.x}
                  y={GRAPH.height - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill={isSelected ? "#fafafa" : CHART.muted}
                >
                  {answers[point.index].number}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredPoint && hoveredAnswer && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${hoverLeftPct}%`,
              top: `calc(${((hoveredPoint.y ?? baseline) / GRAPH.height) * 100}% - 10px)`,
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-zinc-50">
              <VerdictGlyph meta={hoveredPoint.meta} size="sm" />
              {hoveredPoint.meta.score === null ? "Not scored" : `${hoveredPoint.meta.score} · ${hoveredPoint.meta.label}`}
            </p>
            <p className="mt-0.5 text-zinc-400">Answer {hoveredAnswer.number}</p>
            {hoveredAnswer.finding ? (
              <>
                <p className="mt-1 leading-relaxed text-zinc-300">
                  <span className="text-zinc-500">Why: </span>
                  {hoveredAnswer.finding.explanation}
                </p>
                {hoveredAnswer.finding.improvement && (
                  <p className="mt-1 leading-relaxed text-zinc-400">
                    <span className="text-zinc-500">Try: </span>
                    {hoveredAnswer.finding.improvement}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1 text-zinc-500">Generate the review to get a verdict for this answer.</p>
            )}
          </div>
        )}
        {/* Keyboard / screen-reader stable list: the SVG is visual only. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {answers.map((answer, index) => {
            const meta = verdictOf(answer);
            return (
              <button
                key={answer.turnId}
                type="button"
                onClick={() => onSelect(index)}
                title={answer.finding ? `Answer ${answer.number} — ${meta.label}: ${answer.finding.explanation}` : `Answer ${answer.number} — ${meta.label}`}
                aria-label={`Go to answer ${answer.number}, ${meta.label}`}
                aria-current={index === selected ? "true" : undefined}
                className={`rounded-md border px-2.5 py-1 text-xs transition focus-visible:outline-2 focus-visible:outline-accent ${index === selected ? "border-accent bg-accent/10 text-accent-deep" : "border-dash-border-strong text-dash-text-muted hover:text-dash-text"}`}
              >
                {answer.number} · {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function AccuracySummary({ answers, skippedCount = 0 }: { answers: ReviewAnswer[]; skippedCount?: number }) {
  const scoredAnswers = answers.filter((answer) => verdictOf(answer).score !== null);
  const skipped = Math.max(0, Math.floor(skippedCount));
  const denominator = scoredAnswers.length + skipped;
  const accuracy = reportScoreFromVerdicts(
    answers.flatMap((answer) => answer.finding?.verdict ? [answer.finding.verdict] : []),
    skipped,
  );
  const rows = SUMMARY_ORDER.map((verdict) => ({
    verdict,
    meta: VERDICTS[verdict],
    count: answers.filter((answer) => answer.finding?.verdict === verdict).length,
  })).filter((row) => row.verdict !== "insufficient_evidence" || row.count > 0);

  return (
    <section className="relative flex flex-col gap-5 overflow-hidden rounded-xl bg-[#101817] p-6 text-white shadow-[0_18px_45px_rgba(18,55,50,0.14)]">
      <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 className="relative text-sm font-medium text-white/55">Interview accuracy</h2>
        <p className="relative text-5xl font-semibold tracking-[-0.05em] text-white tabular-nums">{accuracy === null ? "—" : `${accuracy}/100`}</p>
        <p className="relative text-xs text-white/45">
          {denominator === 0
            ? "No answers have been reviewed yet"
            : skipped > 0
              ? `Across ${scoredAnswers.length} scored + ${skipped} skipped (0 pts each)`
              : `Across ${scoredAnswers.length} scored ${scoredAnswers.length === 1 ? "answer" : "answers"}`}
        </p>
      </div>
      {answers.length > 0 && <ul className="relative flex flex-col gap-2 border-t border-white/10 pt-4">
        {rows.map((row) => (
          <li key={row.verdict} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-white/70">
              <VerdictGlyph meta={row.meta} size="sm" />
              {row.meta.label}
            </span>
            <span className="text-white tabular-nums">{row.count}</span>
          </li>
        ))}
        {skipped > 0 && (
          <li className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-white/70">
              <VerdictGlyph meta={{ label: "Skipped", glyph: "✕", color: "#52514e", score: 0 }} size="sm" />
              Skipped (0 pts)
            </span>
            <span className="text-white tabular-nums">{skipped}</span>
          </li>
        )}
      </ul>}
    </section>
  );
}

function KeyProblems({ overview }: { overview: ReportOverview }) {
  return (
    <Card title="Key problems to fix">
      <p className="text-sm leading-relaxed text-dash-text-muted">{overview.summary}</p>
      <ol className="flex flex-col gap-2">
        {overview.keyProblems.map((problem, index) => (
          <li key={index} className="flex gap-2 text-sm text-dash-text">
            <span className="text-dash-text-faint tabular-nums">{index + 1}.</span>
            {problem}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function MoveList({ answers, selected, onSelect }: {
  answers: ReviewAnswer[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Card title="Answers">
      <ol className="flex flex-col gap-1">
        {answers.map((answer, index) => {
          const meta = verdictOf(answer);
          const isSelected = index === selected;
          return (
            <li key={answer.turnId}>
              <button
                type="button"
                aria-current={isSelected ? "true" : undefined}
                title={answer.finding ? `${meta.label}: ${answer.finding.explanation}` : meta.label}
                onClick={() => onSelect(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-accent ${isSelected ? "bg-dash-surface-muted" : "hover:bg-dash-surface-hover"}`}
              >
                <span className="w-5 shrink-0 text-right text-dash-text-faint tabular-nums">{answer.number}.</span>
                <VerdictGlyph meta={meta} size="sm" />
                <span className="min-w-0 flex-1 truncate text-dash-text">{answer.question ?? "Answer"}</span>
                <span className="shrink-0 text-xs text-dash-text-faint">{meta.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function SessionIssues({ mistakes }: { mistakes: ProcessMistake[] }) {
  return (
    <section className="rounded-xl border border-dash-border bg-dash-surface px-5 py-5">
      <h2 className="text-lg font-semibold tracking-tight text-dash-text">Session events</h2>
      <p className="mt-1 text-sm text-dash-text-muted">A timeline of anything that affected this report.</p>
      <ul className="mt-4 divide-y divide-dash-border border-y border-dash-border">
        {mistakes.map((mistake, index) => (
          <li key={index} className="flex gap-3 py-3 text-sm text-dash-text-muted">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d03b3b]" />
            <span>
              <span className="font-semibold text-dash-text">{PROCESS_MISTAKE_LABEL[mistake.kind]}</span> — {mistake.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextSteps() {
  return (
    <section className="rounded-xl border border-accent/20 bg-accent/5 px-5 py-5 sm:px-6">
      <h2 className="text-lg font-semibold tracking-tight text-dash-text">What to do next</h2>
      <p className="mt-1 text-sm text-dash-text-muted">Try again with one complete response and this report will become much more useful.</p>
      <ol className="mt-5 grid gap-5 sm:grid-cols-3">
        {EMPTY_REPORT_NEXT_STEPS.map(([title, body], index) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent-deep">{index + 1}</span>
            <span>
              <span className="block text-sm font-semibold text-dash-text">{title}</span>
              <span className="mt-1 block text-sm leading-5 text-dash-text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link href="/interview/setup" className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-dash-on-accent transition duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]">
        Start another practice <ArrowRightIcon size={14} weight="bold" />
      </Link>
    </section>
  );
}

/** Chess.com-style game review for an interview: step through answers, see verdicts and why. */
export function InterviewReview({ review, overview, aside, evidence, sessionId }: {
  review: SessionReview;
  overview: ReportOverview | null;
  aside?: ReactNode;
  evidence?: ReactNode;
  sessionId?: string | null;
}) {
  const [selected, setSelected] = useState(0);
  const count = review.answers.length;
  const skippedTotal = review.processMistakes.filter((m) => m.kind === "skipped_question").length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "VIDEO"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") setSelected((index) => Math.min(count - 1, index + 1));
      if (event.key === "ArrowLeft") setSelected((index) => Math.max(0, index - 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count]);

  if (count === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <AccuracySummary answers={[]} skippedCount={skippedTotal} />
          <section className="flex min-h-52 items-center rounded-xl border border-dash-border bg-dash-surface p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-dash-surface-muted text-dash-text-muted ring-1 ring-dash-border">
                <FileTextIcon size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-dash-text">No answer was submitted</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-dash-text-muted">
                  {skippedTotal > 0
                    ? `${skippedTotal} skipped ${skippedTotal === 1 ? "answer was" : "answers were"} counted as 0. Detailed coaching needs at least one recorded response.`
                    : "No responses were recorded in this session, so detailed answer coaching is unavailable."}
                </p>
              </div>
            </div>
          </section>
        </div>
        {evidence}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
          {review.processMistakes.length > 0 && <SessionIssues mistakes={review.processMistakes} />}
          {aside}
        </div>
        <NextSteps />
      </div>
    );
  }

  const current = Math.min(selected, count - 1);
  const step = (delta: number) => setSelected((index) => Math.min(count - 1, Math.max(0, index + delta)));
  const skippedCount = skippedTotal;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <AnswerDetail
          key={review.answers[current].turnId}
          answer={review.answers[current]}
          total={count}
          answers={review.answers}
          selected={current}
          sessionId={sessionId ?? null}
          onStep={step}
          onSelect={setSelected}
        />
        <SessionTimelineStrip answers={review.answers} selected={current} onSelect={setSelected} />
        <EvaluationGraph answers={review.answers} selected={current} onSelect={setSelected} />
        {evidence}
      </div>
      <aside className="flex flex-col gap-6">
        <AccuracySummary answers={review.answers} skippedCount={skippedCount} />
        {overview && <KeyProblems overview={overview} />}
        <MoveList answers={review.answers} selected={current} onSelect={setSelected} />
        {review.processMistakes.length > 0 && <SessionIssues mistakes={review.processMistakes} />}
        {aside}
      </aside>
    </div>
  );
}
