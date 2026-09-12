const PRINCIPLES = [
  "Recording consent is explicit, every time.",
  "Practice recordings are private unless you share them.",
  "Camera signals are never scored, only reviewed by a human if you ask.",
  "Insufficient evidence is reported, not guessed into a score.",
];

const COMPETENCIES = [
  {
    name: "Ownership",
    state: "noted" as const,
    quote: "I led the redesign and made the call to cut scope.",
  },
  {
    name: "Reasoning",
    state: "insufficient" as const,
    quote: null,
  },
  {
    name: "Clarity",
    state: "noted" as const,
    quote: "Organized as situation, action, then outcome.",
  },
  {
    name: "Outcome",
    state: "noted" as const,
    quote: "Onboarding completion rose after the change shipped.",
  },
];

export function TrustSection() {
  return (
    <section id="trust" className="border-t border-border py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-14">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Scored on <em className="italic">evidence</em>, not
              impressions.
            </h2>
            <ul className="mt-6 flex flex-col gap-3">
              {PRINCIPLES.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                  <CheckIcon />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-sm font-medium text-foreground">
                Evaluation report
              </span>
              <span className="font-mono text-xs text-muted">Rubric v1</span>
            </div>
            <ul className="divide-y divide-border">
              {COMPETENCIES.map((c) => (
                <li key={c.name} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{c.name}</span>
                    <span
                      className={`text-xs ${
                        c.state === "noted" ? "text-accent" : "text-muted"
                      }`}
                    >
                      {c.state === "noted" ? "noted" : "insufficient evidence"}
                    </span>
                  </div>
                  {c.quote && (
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      &ldquo;{c.quote}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="mt-0.5 shrink-0 text-accent"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.2 8.2 7.1 10l3.7-4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
