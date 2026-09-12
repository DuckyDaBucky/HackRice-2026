const QUESTIONS = [
  { label: "Tell me about your background", state: "done" },
  { label: "Walk through a project you own", state: "active" },
  { label: "A time you debugged under pressure", state: "queued" },
  { label: "How you handle disagreement", state: "queued" },
] as const;

const EVIDENCE = [
  { label: "Ownership", state: "noted" },
  { label: "Reasoning", state: "insufficient" },
  { label: "Clarity", state: "noted" },
] as const;

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="h-2.5 w-2.5 rounded-full bg-border" />
        <span className="ml-2 font-mono text-xs text-muted">
          Practice session &middot; preview
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
        <div className="border-b border-border p-4 sm:border-b-0 sm:border-r">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            Questions
          </p>
          <ul className="mt-3 flex flex-col gap-1">
            {QUESTIONS.map((q) => (
              <li
                key={q.label}
                className={`rounded-lg px-2.5 py-2 text-sm ${
                  q.state === "active"
                    ? "bg-accent/10 text-foreground"
                    : q.state === "done"
                      ? "text-muted line-through decoration-muted/50"
                      : "text-muted"
                }`}
              >
                {q.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-accent">
            Question 2 of 4
          </p>
          <p className="mt-2 text-lg font-medium text-foreground">
            Walk through a project you own end to end.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-sm leading-relaxed text-muted">
              &ldquo;I led the redesign of our onboarding flow. I started by
              looking at where users dropped off, then&hellip;&rdquo;
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {EVIDENCE.map((e) => (
              <span
                key={e.label}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                  e.state === "noted"
                    ? "border-accent/30 text-accent"
                    : "border-border text-muted"
                }`}
              >
                {e.label}
                <span className="text-[11px] opacity-80">
                  {e.state === "noted" ? "noted" : "insufficient evidence"}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
