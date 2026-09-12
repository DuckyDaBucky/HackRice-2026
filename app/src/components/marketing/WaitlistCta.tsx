import { WaitlistForm } from "./WaitlistForm";

export function WaitlistCta() {
  return (
    <section id="waitlist" className="scroll-mt-20 bg-[#fafbfc] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl px-6 py-10 sm:px-10 sm:py-12"
          style={{
            background: "linear-gradient(135deg, #0b1120, #123b34)",
          }}
        >
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
                Practice. Hire. Grow.
              </p>
              <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Your next opportunity starts here.
              </h2>
            </div>
            <div>
              <WaitlistForm />
              <p className="mt-2 text-xs text-white/60">
                Free during early access. No credit card required.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
