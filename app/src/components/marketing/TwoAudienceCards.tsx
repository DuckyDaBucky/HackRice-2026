import Link from "next/link";
import BorderGlow from "./BorderGlow";

const INDIVIDUAL_POINTS = [
  "Questions built from your actual resume and projects",
  "Recorded or live practice, your choice",
  "Feedback that names insufficient evidence instead of guessing",
  "Private by default, always your call to share",
];

const EMPLOYER_POINTS = [
  "Structured, consistent questions for every candidate in a role",
  "Every score linked back to a transcript excerpt",
  "Compare candidates side by side on the same rubric",
  "Insufficient evidence is flagged, never guessed",
];

export function TwoAudienceCards() {
  return (
    <section className="bg-[#f4f5f7] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BorderGlow
            id="individuals"
            className="scroll-mt-20 p-8 sm:p-10"
            backgroundColor="#eef1f6"
            borderRadius={16}
            glowRadius={24}
            glowIntensity={0.5}
            fillOpacity={0.3}
            glowColor="222 15 55"
            colors={["#64748b", "#94a3b8", "#334155"]}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4a5568]">
              For individuals
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0b1120]">
              Practice with purpose.
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-[#3f4a52]">
              Personalized mock interviews based on your resume and target
              role, with feedback that is honest about what it can and
              cannot tell.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {INDIVIDUAL_POINTS.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2.5 text-sm text-[#2b353b]"
                >
                  <Check color="#4a5568" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-[#0b1120] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Sign up
              <ArrowIcon />
            </Link>
          </BorderGlow>

          <BorderGlow
            id="employers"
            className="scroll-mt-20 p-8 sm:p-10"
            backgroundColor="#e9f6f1"
            borderRadius={16}
            glowRadius={24}
            glowIntensity={0.5}
            fillOpacity={0.3}
            glowColor="173 65 55"
            colors={["#1ec9b3", "#5eead4", "#0f766e"]}
          >
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#3a7a68]">
              For employers
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0b1120]">
              Hire with evidence.
            </h2>
            <p className="mt-3 max-w-sm text-base leading-relaxed text-[#3f4a52]">
              Structured interviews and rubric-based evaluation, with every
              score linked back to a transcript.
            </p>
            <ul className="mt-6 flex flex-col gap-3">
              {EMPLOYER_POINTS.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2.5 text-sm text-[#2b353b]"
                >
                  <Check color="#1ec9b3" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex w-fit items-center gap-1.5 self-start rounded-full bg-[#0b1120] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Sign up
              <ArrowIcon />
            </Link>
          </BorderGlow>
        </div>
      </div>
    </section>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.2" />
      <path
        d="M5.2 8.2 7.1 10l3.7-4"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
