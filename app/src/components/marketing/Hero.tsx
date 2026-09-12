import { ProductPreview } from "./ProductPreview";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section id="top" className="pt-16 sm:pt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Pre-launch
        </p>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Interview practice that knows your resume.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Questions and follow-ups built from your actual projects, feedback
          grounded in what you said, not a guess.
        </p>
        <div className="mt-8">
          <WaitlistForm />
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-5xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <ProductPreview />
      </div>
    </section>
  );
}
