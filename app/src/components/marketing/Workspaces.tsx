function Tag({ tone = "muted", children }: { tone?: "muted" | "accent" | "dashed"; children: React.ReactNode }) {
  const cls =
    tone === "accent"
      ? "border-accent/30 text-accent"
      : tone === "dashed"
        ? "border-dashed border-border text-muted"
        : "border-border text-muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

export function Workspaces() {
  return (
    <section id="workspaces" className="border-t border-border py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          For candidates. For employers.
        </h2>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          The evidence used to help you practice is the same evidence an
          employer reviews.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-3">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-sm font-medium text-foreground">
                Candidate workspace
              </span>
              <Tag>Product Designer</Tag>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <span className="text-sm text-foreground">resume.pdf</span>
                <Tag>parsed</Tag>
              </div>
              <ul className="mt-3 divide-y divide-border">
                <li className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">Oct 2 &middot; practice session</span>
                  <Tag tone="accent">reviewed</Tag>
                </li>
                <li className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">Sep 28 &middot; practice session</span>
                  <Tag tone="dashed">insufficient evidence</Tag>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted">
                Private by default. You choose what to share.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-sm font-medium text-foreground">
                Employer workspace
              </span>
            </div>
            <div className="p-5">
              <p className="text-sm text-foreground">Senior Product Designer</p>
              <ul className="mt-3 divide-y divide-border">
                <li className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">M. R.</span>
                  <Tag tone="accent">evaluated</Tag>
                </li>
                <li className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">D. K.</span>
                  <Tag>interviewing</Tag>
                </li>
                <li className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">A. S.</span>
                  <Tag>screened</Tag>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted">
                Every evaluation links back to a rubric and a transcript.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
