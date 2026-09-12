import { ProductPreview } from "./ProductPreview";

export function Hero() {
  return (
    <section id="top" className="overflow-hidden pt-14 sm:pt-16">
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">
              Interview practice &amp; hiring platform
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Interview practice
              <br />
              <span className="text-accent">that knows your resume.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
              Questions and follow-ups drawn from your actual projects.
              Feedback grounded in what you said, not a guess.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#waitlist"
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Join the waitlist
                <ArrowIcon />
              </a>
              <a
                href="#employers"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
              >
                I&rsquo;m hiring
                <ArrowIcon />
              </a>
            </div>
          </div>

          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M2 6h7M6 3l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
