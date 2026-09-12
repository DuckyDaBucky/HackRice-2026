import { WaitlistForm } from "./WaitlistForm";

export function WaitlistCta() {
  return (
    <section id="waitlist" className="border-t border-border py-14 sm:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Be first to practice.
          </h2>
          <p className="mt-2 text-sm text-muted">
            We will let you know when recorded practice interviews open.
          </p>
        </div>
        <WaitlistForm />
      </div>
    </section>
  );
}
