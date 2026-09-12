import { ProductPreview } from "./ProductPreview";

export function Hero() {
  return (
    <section id="top" className="overflow-hidden pt-20 sm:pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="max-w-4xl text-6xl font-normal leading-[1.05] tracking-tight text-foreground sm:text-7xl">
          Interview practice
          <br />
          <span className="text-accent">that knows your resume.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
          Questions and follow-ups drawn from your actual projects. Feedback
          grounded in what you said, not a guess.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-end gap-6">
          <a
            href="#waitlist"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-accent"
          >
            Join the waitlist
            <ArrowIcon />
          </a>
          <a
            href="#employers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            I&rsquo;m hiring
            <ArrowIcon />
          </a>
        </div>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div
          className="pointer-events-none absolute -inset-x-10 -top-24 -bottom-10 -z-10 bg-[radial-gradient(ellipse_60%_60%_at_50%_20%,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent)] blur-2xl"
          aria-hidden="true"
        />
        <ProductPreview />
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
