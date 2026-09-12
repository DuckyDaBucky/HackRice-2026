import { Reveal } from "./Reveal";

export function Workspaces() {
  return (
    <section id="workspaces" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            One engine, two workspaces
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            The same contextual interviewing engine powers private practice
            and employer screening, so rehearsal looks like the real thing.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-8">
          <Reveal className="lg:col-span-3">
            <div
              className="h-full rounded-3xl p-8 sm:p-10"
              style={{
                background:
                  "linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 14%, var(--color-bg-elevated)), var(--color-bg-elevated))",
              }}
            >
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-accent">
                Practice
              </span>
              <h3 className="mt-3 text-3xl font-semibold text-foreground">
                Rehearse privately
              </h3>
              <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
                Recorded or live mock interviews, evidence-linked feedback
                reports, private by default. It is always your call whether
                to share a result.
              </p>
            </div>
          </Reveal>

          <Reveal delay={100} className="lg:col-span-2">
            <div className="flex h-full flex-col border-t border-border pt-6">
              <span className="font-mono text-xs uppercase tracking-[0.15em] text-muted">
                Corporate
              </span>
              <h3 className="mt-3 text-2xl font-semibold text-foreground">
                Screen with confidence
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Configure rubrics and requisitions, send scoped and expiring
                interview invites, and hand human interviewers an
                AI-assisted answer guide instead of one canonical answer.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
