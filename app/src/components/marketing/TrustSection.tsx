import { Reveal } from "./Reveal";

const ITEMS = [
  {
    n: "01",
    title: "Consent, always disclosed",
    body: "Recording consent is explicit every time, before anything is captured.",
  },
  {
    n: "02",
    title: "Private by default",
    body: "Practice recordings stay private unless you choose to share them.",
  },
  {
    n: "03",
    title: "No camera scoring",
    body: "Camera signals never factor into a score, only optional human review.",
  },
  {
    n: "04",
    title: "Honest about gaps",
    body: "Insufficient evidence stays labeled that way instead of becoming a guessed score.",
  },
];

export function TrustSection() {
  return (
    <section id="trust" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Scored on evidence, not impressions.
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted">
              A rubric that admits when it does not know, and a firm line
              between what a camera sees and what counts toward a score.
            </p>
          </Reveal>

          <div className="divide-y divide-border border-t border-border lg:border-t-0">
            {ITEMS.map((item, i) => (
              <Reveal key={item.n} delay={i * 80}>
                <div className="grid grid-cols-[3rem_1fr] gap-4 py-6 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
                  <span className="font-mono text-sm text-muted">{item.n}</span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
