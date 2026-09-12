import { LogoMark } from "./Logo";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-24 -top-24 opacity-[0.07] sm:-right-16 sm:-top-32"
        aria-hidden="true"
      >
        <LogoMark size={520} />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 sm:px-6 sm:pb-28 sm:pt-28 lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Pre-launch
        </p>
        <h1 className="mt-5 max-w-3xl text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          Interview practice that knows your resume.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Questions and follow-ups built from your actual projects, feedback
          grounded in what you said, not a guess.
        </p>
        <div className="mt-9">
          <WaitlistForm />
        </div>
      </div>
    </section>
  );
}
