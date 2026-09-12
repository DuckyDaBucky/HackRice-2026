const EVIDENCE = [
  { label: "Ownership", state: "noted" as const },
  { label: "Reasoning", state: "insufficient" as const },
  { label: "Clarity", state: "noted" as const },
];

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-sm text-muted">
          Practice &middot; Product Designer
        </span>
        <span className="font-mono text-xs text-muted">Question 3 of 6</span>
      </div>
      <div className="h-px w-full bg-border">
        <div className="h-px w-1/2 bg-accent" />
      </div>

      <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-[280px_1fr]">
        <div className="relative flex flex-col items-center justify-center gap-3 bg-bg-elevated px-6 py-10">
          <span className="absolute left-4 top-4 flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            Recording
          </span>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border text-sm font-medium text-foreground">
            JD
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <MicOffIcon />
            You
          </div>
        </div>

        <div className="bg-surface px-6 py-5">
          <p className="text-xs text-muted">Current question</p>
          <p className="mt-1.5 text-lg font-medium leading-snug text-foreground">
            Tell me about a time you made a decision with incomplete
            information.
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/70 bg-bg-elevated px-3 py-2.5">
            <BranchIcon />
            <p className="text-sm text-muted">
              Follow-up: what data did you wish you had at the time?
            </p>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-muted">Live transcript</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              &ldquo;We were two weeks from launch and the usage data hadn&rsquo;t
              come in yet, so I looked at support tickets from the beta
              instead
              <span className="inline-block w-1.5 animate-pulse bg-muted/60 align-middle">
                &nbsp;
              </span>
              &rdquo;
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
        {EVIDENCE.map((e) => (
          <span
            key={e.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              e.state === "noted"
                ? "border-accent/30 text-accent"
                : "border-dashed border-border text-muted"
            }`}
          >
            {e.label}
            <span className="opacity-80">
              {e.state === "noted" ? "noted" : "insufficient evidence"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MicOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 2L14 14M8 1.5a2 2 0 0 1 2 2v3.2M6 6.7V3.5a2 2 0 0 1 .6-1.43M4.5 8a3.5 3.5 0 0 0 5.6 2.8M11.4 9A3.5 3.5 0 0 0 11.5 8M8 11.5V14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-accent"
    >
      <path
        d="M4 2.5v5c0 1.5 1 2.5 2.5 2.5H10M9 11.5l3-2 -3-2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
