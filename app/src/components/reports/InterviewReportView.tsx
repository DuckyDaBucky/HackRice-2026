import type { StoredReportFinding } from "@/lib/reports/persistence";
import type { SessionTimeline } from "@/lib/reports/timeline";

const COMPETENCY_LABEL: Record<string, string> = {
  concrete_example: "Concrete example",
  technical_reasoning: "Technical reasoning",
  structured_communication: "Structured communication",
  ownership_and_impact: "Ownership & impact",
};

const KIND_STYLE: Record<string, string> = {
  strength: "bg-emerald-500/10 text-emerald-400",
  gap: "bg-amber-500/10 text-amber-400",
  insufficient_evidence: "bg-zinc-500/10 text-zinc-400",
};

const KIND_LABEL: Record<string, string> = {
  strength: "Strength",
  gap: "Gap",
  insufficient_evidence: "Insufficient evidence",
};

const PROCESS_MISTAKE_LABEL: Record<string, string> = {
  skipped_question: "Skipped",
  time_overrun: "Over time",
  upload_failed: "Upload failed",
};

function FindingBadge({ finding }: { finding: StoredReportFinding }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${KIND_STYLE[finding.kind]}`}>
      {KIND_LABEL[finding.kind]} · {COMPETENCY_LABEL[finding.competencyId] ?? finding.competencyId}
    </span>
  );
}

export function FindingsPanel({ findings }: { findings: StoredReportFinding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-zinc-500">No findings yet.</p>;
  }
  const grouped = ["strength", "gap", "insufficient_evidence"].map((kind) => ({
    kind,
    items: findings.filter((finding) => finding.kind === kind),
  }));
  return (
    <div className="flex flex-col gap-4">
      {grouped.map(
        (group) =>
          group.items.length > 0 && (
            <div key={group.kind} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-zinc-400">{KIND_LABEL[group.kind]}</h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((finding) => (
                  <li key={finding.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
                    <p className="text-sm text-zinc-200">{finding.finding}</p>
                    {finding.improvement && (
                      <p className="mt-1 text-sm text-zinc-500">Try next: {finding.improvement}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
    </div>
  );
}

export function InterviewTimeline({ timeline }: { timeline: SessionTimeline }) {
  return (
    <div className="flex flex-col gap-4">
      {timeline.processMistakes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {timeline.processMistakes.map((mistake, index) => (
            <span
              key={index}
              className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400"
              title={mistake.detail}
            >
              {PROCESS_MISTAKE_LABEL[mistake.kind]}
            </span>
          ))}
        </div>
      )}
      <ol className="flex flex-col gap-3">
        {timeline.turns.map((turn) => (
          <li key={turn.turnId} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500 uppercase">{turn.kind.replace(/_/g, " ")}</span>
              {turn.findings.map((finding) => (
                <FindingBadge key={finding.id} finding={finding} />
              ))}
              {turn.transcriptMarkers && turn.transcriptMarkers.longPauses.length > 0 && (
                <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                  {turn.transcriptMarkers.longPauses.length} long pause
                  {turn.transcriptMarkers.longPauses.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {turn.prompt && <p className="mt-2 text-sm font-medium text-zinc-200">{turn.prompt}</p>}
            {turn.text && <p className="mt-1 text-sm text-zinc-400">{turn.text}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
