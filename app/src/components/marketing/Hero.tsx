import { ProductPreview } from "./ProductPreview";
import { TiltCard } from "./TiltCard";

export function Hero() {
  return (
    <section id="top" className="overflow-hidden pt-20 sm:pt-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h1 className="max-w-2xl text-5xl font-medium leading-[1.05] tracking-tight text-foreground sm:text-6xl">
          Interview practice
          <br />
          <span className="text-accent">that knows your resume.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted">
          Questions and follow-ups drawn from your actual projects. Feedback
          grounded in what you said, not a guess.
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

      <div className="mx-auto mt-14 max-w-4xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <TiltCard>
          <ProductPreview />
        </TiltCard>
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
