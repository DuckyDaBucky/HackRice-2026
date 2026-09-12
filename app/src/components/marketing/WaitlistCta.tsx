import { Reveal } from "./Reveal";
import { WaitlistForm } from "./WaitlistForm";

export function WaitlistCta() {
  return (
    <section
      className="py-24 sm:py-32"
      style={{
        background:
          "linear-gradient(180deg, var(--color-background), color-mix(in srgb, var(--color-accent) 10%, var(--color-background)))",
      }}
    >
      <Reveal className="mx-auto flex max-w-2xl flex-col items-center px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Be first to practice.
        </h2>
        <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
          Leave your email and we will let you know the moment recorded
          practice interviews open.
        </p>
        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>
        <p className="mt-3 text-xs text-muted">
          No spam, just a heads up when practice opens.
        </p>
      </Reveal>
    </section>
  );
}
