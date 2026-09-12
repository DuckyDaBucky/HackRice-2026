import { ProductPreview } from "./ProductPreview";
import { WaitlistForm } from "./WaitlistForm";

export function Hero() {
  return (
    <section id="top" className="pt-14 sm:pt-16">
      <div id="product" className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Interview practice that knows your resume.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
          Questions and follow-ups drawn from your actual projects. Feedback
          grounded in what you said, not a guess.
        </p>
        <div className="mt-7">
          <WaitlistForm />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <ProductPreview />
      </div>
    </section>
  );
}
