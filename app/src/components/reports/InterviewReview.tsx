"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ProcessMistake } from "@/lib/analytics/process-events";
import type { ReportOverview } from "@/lib/reports/contracts";
import type { ReviewAnswer, SessionReview } from "@/lib/reports/timeline";
import { formatDuration } from "@/lib/recording/format-duration";

interface VerdictMeta {
  label: string;
  glyph: string;
  color: string;
  score: number | null;
}

// Status palette (good / warning / serious / critical): color never carries a verdict alone — the
// chess glyph and text label always ride with it, and the graph encodes quality by position.
const VERDICTS: Record<string, VerdictMeta> = {
  best: { label: "Best", glyph: "!!", color: "#0ca30c", score: 100 },
  good: { label: "Good", glyph: "!", color: "#0ca30c", score: 80 },
  inaccuracy: { label: "Inaccuracy", glyph: "?!", color: "#fab219", score: 55 },
  mistake: { label: "Mistake", glyph: "?", color: "#ec835a", score: 30 },
  blunder: { label: "Blunder", glyph: "??", color: "#d03b3b", score: 5 },
  insufficient_evidence: { label: "Not evaluated", glyph: "–", color: "#898781", score: null },
};
const NOT_REVIEWED: VerdictMeta = { label: "Not reviewed", glyph: "·", color: "#52514e", score: null };
const SUMMARY_ORDER = ["best", "good", "inaccuracy", "mistake", "blunder", "insufficient_evidence"];

const CHART = { surface: "#111113", grid: "#2c2c2a", axis: "#383835", muted: "#898781", line: "#3987e5" };
const GRAPH = { width: 640, height: 200, left: 40, right: 16, top: 16, bottom: 30 };

const PROCESS_MISTAKE_LABEL: Record<ProcessMistake["kind"], string> = {
  skipped_question: "Skipped question",
  time_overrun: "Over time",
  upload_failed: "Upload failed",
};

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
    <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-medium text-zinc-400">{title}</h2>
        {hint && <span className="text-xs text-zinc-500">{hint}</span>}
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
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function AnswerDetail({ answer, total, onStep }: { answer: ReviewAnswer; total: number; onStep: (delta: number) => void }) {
  const meta = verdictOf(answer);
  const router = useRouter();
  const [clipExpired, setClipExpired] = useState(false);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>
            Answer {answer.number} of {total}
          </span>
          {answer.isFollowUp && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">Follow-up</span>
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

      {answer.clip ? (
        clipExpired ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
            <span>Recording link expired (signed URLs last ~1h).</span>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="rounded-full border border-sky-400/40 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/10"
            >
              Refresh links
            </button>
          </div>
        ) : (
          <video
            key={answer.turnId}
            src={answer.clip.url}
            controls
            preload="metadata"
            playsInline
            onError={() => setClipExpired(true)}
            className="aspect-video w-full rounded-xl bg-black"
          />
        )
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
          No recording was saved for this answer
        </div>
      )}

      {answer.question && <h2 className="text-base font-medium text-zinc-50">{answer.question}</h2>}

      <div className="flex flex-col gap-2 rounded-xl bg-zinc-950/60 p-4">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
          <VerdictGlyph meta={meta} />
          {meta.label}
        </span>
        {answer.finding ? (
          <>
            <p className="text-sm leading-relaxed text-zinc-300">
              <span className="text-zinc-500">Why: </span>
              {answer.finding.explanation}
            </p>
            {answer.finding.improvement && (
              <p className="text-sm leading-relaxed text-zinc-300">
                <span className="text-zinc-500">Try instead: </span>
                {answer.finding.improvement}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">Generate the review to get a verdict for this answer.</p>
        )}
      </div>

      {answer.transcript && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-200">Transcript</summary>
          <p className="mt-2 leading-relaxed text-zinc-400">{answer.transcript}</p>
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
  const timed = answers.every((answer) => answer.clip?.durationMs);
  const weights = answers.map((answer) => (timed ? answer.clip?.durationMs ?? 1 : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const starts = weights.map((_, index) => weights.slice(0, index).reduce((sum, weight) => sum + weight, 0));
  const hoveredAnswer = hovered === null ? null : answers[hovered];

  return (
    <Card title="Interview timeline" hint={timed ? "Width shows how long each answer ran" : "Answers in order"}>
      <div className="relative">
        {hoveredAnswer && hovered !== null && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            style={{ left: `${((starts[hovered] + weights[hovered] / 2) / total) * 100}%` }}
          >
            <p className="text-sm font-semibold text-zinc-50">{verdictOf(hoveredAnswer).label}</p>
            <p className="text-zinc-400">
              Answer {hoveredAnswer.number}
              {hoveredAnswer.clip?.durationMs ? ` · ${formatDuration(hoveredAnswer.clip.durationMs)}` : ""}
            </p>
          </div>
        )}
        <div className="flex h-9 gap-[2px]">
          {answers.map((answer, index) => {
            const meta = verdictOf(answer);
            const isSelected = index === selected;
            return (
              <button
                key={answer.turnId}
                type="button"
                aria-label={`Answer ${answer.number}: ${meta.label}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(index)}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                style={{ flexGrow: weights[index], flexBasis: 0, backgroundColor: meta.color, color: inkOn(meta.color) }}
                className={`min-w-3 text-xs font-bold transition first:rounded-l-[4px] last:rounded-r-[4px] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 ${isSelected ? "outline-2 outline-offset-2 outline-zinc-100" : ""}`}
              >
                {weights[index] / total >= 0.08 ? meta.glyph : null}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-zinc-500 tabular-nums">
          <span>{timed ? "0:00" : "Start"}</span>
          <span>{timed ? formatDuration(total) : "End"}</span>
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
        <p className="py-6 text-center text-sm text-zinc-500">The quality graph appears once answers are reviewed.</p>
      </Card>
    );
  }

  const nearestIndex = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * GRAPH.width;
    return points.reduce((best, point) => (Math.abs(point.x - x) < Math.abs(points[best].x - x) ? point.index : best), 0);
  };
  const hoveredPoint = hovered === null ? null : points[hovered];

  return (
    <Card title="Answer quality across the interview" hint="Click a point to review that answer">
      <div className="relative">
        <svg
          viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label="Answer quality score by answer number, from 0 (blunder) to 100 (best)"
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

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs whitespace-nowrap shadow-lg"
            style={{
              left: `${(hoveredPoint.x / GRAPH.width) * 100}%`,
              top: `calc(${((hoveredPoint.y ?? baseline) / GRAPH.height) * 100}% - 10px)`,
            }}
          >
            <p className="text-sm font-semibold text-zinc-50">
              {hoveredPoint.meta.score === null ? "Not scored" : hoveredPoint.meta.score}
            </p>
            <p className="text-zinc-400">
              Answer {answers[hoveredPoint.index].number} · {hoveredPoint.meta.label}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function AccuracySummary({ answers }: { answers: ReviewAnswer[] }) {
  const scores = answers
    .map((answer) => verdictOf(answer).score)
    .filter((score): score is number => score !== null);
  const accuracy = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const rows = SUMMARY_ORDER.map((verdict) => ({
    verdict,
    meta: VERDICTS[verdict],
    count: answers.filter((answer) => answer.finding?.verdict === verdict).length,
  })).filter((row) => row.verdict !== "insufficient_evidence" || row.count > 0);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-zinc-400">Answer accuracy</h2>
        <p className="text-5xl font-semibold text-zinc-50">{accuracy === null ? "—" : `${accuracy}%`}</p>
        <p className="text-xs text-zinc-500">
          {scores.length
            ? `Across ${scores.length} reviewed ${scores.length === 1 ? "answer" : "answers"}`
            : "No answers have been reviewed yet"}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.verdict} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-zinc-300">
              <VerdictGlyph meta={row.meta} size="sm" />
              {row.meta.label}
            </span>
            <span className="text-zinc-100 tabular-nums">{row.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KeyProblems({ overview }: { overview: ReportOverview }) {
  return (
    <Card title="Key problems to fix">
      <p className="text-sm leading-relaxed text-zinc-300">{overview.summary}</p>
      <ol className="flex flex-col gap-2">
        {overview.keyProblems.map((problem, index) => (
          <li key={index} className="flex gap-2 text-sm text-zinc-200">
            <span className="text-zinc-500 tabular-nums">{index + 1}.</span>
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
                onClick={() => onSelect(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition focus-visible:outline-2 focus-visible:outline-sky-400 ${isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"}`}
              >
                <span className="w-5 shrink-0 text-right text-zinc-500 tabular-nums">{answer.number}.</span>
                <VerdictGlyph meta={meta} size="sm" />
                <span className="min-w-0 flex-1 truncate text-zinc-200">{answer.question ?? "Answer"}</span>
                <span className="shrink-0 text-xs text-zinc-500">{meta.label}</span>
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
    <Card title="Session issues">
      <ul className="flex flex-col gap-2">
        {mistakes.map((mistake, index) => (
          <li key={index} className="flex gap-2 text-sm text-zinc-300">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#d03b3b]" />
            <span>
              <span className="font-medium text-zinc-100">{PROCESS_MISTAKE_LABEL[mistake.kind]}</span> — {mistake.detail}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Chess.com-style game review for an interview: step through answers, see verdicts and why. */
export function InterviewReview({ review, overview, aside }: {
  review: SessionReview;
  overview: ReportOverview | null;
  aside?: ReactNode;
}) {
  const [selected, setSelected] = useState(0);
  const count = review.answers.length;

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
      <p className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
        No answers were recorded in this session, so there is nothing to review yet.
      </p>
    );
  }

  const current = Math.min(selected, count - 1);
  const step = (delta: number) => setSelected((index) => Math.min(count - 1, Math.max(0, index + delta)));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <AnswerDetail key={review.answers[current].turnId} answer={review.answers[current]} total={count} onStep={step} />
        <SessionTimelineStrip answers={review.answers} selected={current} onSelect={setSelected} />
        <EvaluationGraph answers={review.answers} selected={current} onSelect={setSelected} />
      </div>
      <aside className="flex flex-col gap-6">
        <AccuracySummary answers={review.answers} />
        {overview && <KeyProblems overview={overview} />}
        <MoveList answers={review.answers} selected={current} onSelect={setSelected} />
        {review.processMistakes.length > 0 && <SessionIssues mistakes={review.processMistakes} />}
        {aside}
      </aside>
    </div>
  );
}
