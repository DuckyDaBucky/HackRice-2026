import Link from "next/link";

const FEATURES = [
  {
    title: "Objective, evidence-linked scoring",
    body: "Every score ties back to a specific moment in the transcript.",
    icon: ChartIcon,
  },
  {
    title: "Save interviewer time",
    body: "Let the first round run itself, consistently, every time.",
    icon: ClockIcon,
  },
  {
    title: "Compare candidates side by side",
    body: "See scores, strengths, and evidence in one view.",
    icon: CompareIcon,
  },
  {
    title: "Insufficient evidence, flagged not guessed",
    body: "If a rubric item was not addressed, the report says so.",
    icon: FlagIcon,
  },
];

const SIDEBAR = ["Dashboard", "Candidates", "Interviews", "Jobs", "Team", "Settings"];

const CANDIDATES = [
  {
    name: "Alex Chen",
    role: "Software Engineer, 3 years",
    score: 92,
    strengths: "Problem solving, system design, clear communication",
    rec: "Move to next round",
    tone: "good" as const,
  },
  {
    name: "Priya Patel",
    role: "CS Graduate",
    score: 88,
    strengths: "Technical knowledge, strong communication",
    rec: "Move to next round",
    tone: "good" as const,
  },
  {
    name: "Marcus Webb",
    role: "Software Engineer, 2 years",
    score: 76,
    strengths: "Good technical skills, needs clearer examples",
    rec: "Consider",
    tone: "mid" as const,
  },
  {
    name: "Sofia Reyes",
    role: "Data Scientist",
    score: 71,
    strengths: "Analytical thinking, good communication",
    rec: "Consider",
    tone: "mid" as const,
  },
  {
    name: "Jordan Kim",
    role: "CS Graduate",
    score: 64,
    strengths: "Basic knowledge, needs improvement",
    rec: "Not a fit",
    tone: "low" as const,
  },
];

const TONE_CLASSES: Record<string, string> = {
  good: "bg-[#e6f6ee] text-[#1b7a4c]",
  mid: "bg-[#fdf3e2] text-[#9a6b0f]",
  low: "bg-[#fbeaea] text-[#a13a3a]",
};

export function EmployerShowcase() {
  return (
    <section className="bg-[#fafbfc] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.2fr] lg:gap-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#4a5568]">
              For employers
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0b1120] sm:text-4xl">
              Turn interviews into better hiring decisions.
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#3f4a52]">
              GetMeHired runs consistent, role-specific interviews and links
              every evaluation back to a rubric and a transcript, so you can
              focus on the candidates worth a second look.
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef1f6] text-[#0b1120]">
                    <f.icon />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#0b1120]">
                      {f.title}
                    </p>
                    <p className="mt-0.5 text-sm text-[#5b6472]">{f.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-[#0b1120] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Sign up
              <ArrowIcon />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
              <span className="text-sm font-semibold text-[#0b1120]">
                GetMeHired
              </span>
              <span className="rounded-md bg-[#f4f5f7] px-3 py-1 text-xs text-[#5b6472]">
                Search candidates&hellip;
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b1120] text-xs font-medium text-white">
                KR
              </span>
            </div>

            <div className="flex">
              <div className="hidden w-32 shrink-0 flex-col gap-1 border-r border-[#e5e7eb] px-3 py-4 text-xs text-[#5b6472] sm:flex">
                {SIDEBAR.map((item, i) => (
                  <span
                    key={item}
                    className={`rounded-md px-2 py-1.5 ${
                      i === 1 ? "bg-[#eef1f6] font-medium text-[#0b1120]" : ""
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="min-w-0 flex-1 px-4 py-4">
                <p className="text-sm font-semibold text-[#0b1120]">
                  Software Engineer
                </p>
                <div className="mt-2 flex gap-4 border-b border-[#e5e7eb] text-xs text-[#5b6472]">
                  <span className="border-b-2 border-[#0b1120] pb-2 font-medium text-[#0b1120]">
                    All candidates 24
                  </span>
                  <span className="pb-2">Shortlisted 6</span>
                  <span className="pb-2">Second round 3</span>
                  <span className="pb-2">Rejected 15</span>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead>
                      <tr className="text-[#5b6472]">
                        <th className="py-2 font-medium">Candidate</th>
                        <th className="py-2 font-medium">Score</th>
                        <th className="py-2 font-medium">Recommendation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef0f3]">
                      {CANDIDATES.map((c) => (
                        <tr key={c.name}>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-[#0b1120]">
                              {c.name}
                            </p>
                            <p className="text-[#8a92a0]">{c.role}</p>
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-[#0b1120]">
                            {c.score}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full px-2 py-1 text-[11px] font-medium ${TONE_CLASSES[c.tone]}`}
                            >
                              {c.rec}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function iconProps() {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  } as const;
}

function ChartIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M2.5 13.5v-4M7 13.5v-7M11.5 13.5v-2.5M2.5 13.5h11"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="10.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M4 13.5V2.5M4 3l7 1.3-2.2 2.2L11 8.8 4 10"
        stroke="currentColor"
        strokeWidth="1.3"
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
