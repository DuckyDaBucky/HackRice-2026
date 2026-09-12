import { Reveal } from "./Reveal";

const STEPS = [
  {
    n: "01",
    title: "Upload your resume",
    body: "Your projects and experience set the starting point, not a generic template.",
    offset: "",
  },
  {
    n: "02",
    title: "Set your target role",
    body: "Tell us the role you are aiming for so every question stays relevant.",
    offset: "sm:mt-10",
  },
  {
    n: "03",
    title: "Practice the interview",
    body: "Recorded or live, technical-behavioral questions, never live-coding puzzles.",
    offset: "sm:mt-20",
  },
  {
    n: "04",
    title: "Review the evidence",
    body: "Feedback ties back to your transcript, with insufficient evidence flagged honestly.",
    offset: "sm:mt-32",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="max-w-sm text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How practice will work
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-16 sm:grid-cols-4 sm:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90} className={step.offset}>
              <span className="block font-mono text-6xl font-medium leading-none text-muted/40 sm:text-7xl">
                {step.n}
              </span>
              <h3 className="mt-5 text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[22ch] text-sm leading-relaxed text-muted">
                {step.body}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
