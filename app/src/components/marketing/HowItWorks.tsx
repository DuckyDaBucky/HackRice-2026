const STEPS = [
  {
    n: "1",
    title: "Upload or create a profile",
    body: "Add your resume and tell us your target role.",
    icon: ProfileIcon,
  },
  {
    n: "2",
    title: "Practice or screen",
    body: "Answer real questions in a recorded or live interview.",
    icon: CameraIcon,
  },
  {
    n: "3",
    title: "Get the evidence",
    body: "A report scored against a rubric, linked to your transcript.",
    icon: ReportIcon,
  },
  {
    n: "4",
    title: "Take the next step",
    body: "Improve and retry, or move top candidates forward.",
    icon: ArrowUpRightIcon,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-[#e5e7eb] bg-[#fafbfc] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-[#0b1120] sm:text-4xl">
          How it works.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-4 sm:gap-4">
          {STEPS.map((step, i) => (
            <div key={step.n} className="relative">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef1f6] text-[#0b1120]">
                <step.icon />
              </div>
              {i < STEPS.length - 1 && (
                <span className="absolute left-[calc(50%+2.5rem)] top-6 hidden w-[calc(100%-5rem)] items-center text-[#c3c8cf] sm:flex">
                  <ArrowIcon />
                </span>
              )}
              <p className="mt-4 text-sm font-semibold text-[#0b1120]">
                {step.n}. {step.title}
              </p>
              <p className="mx-auto mt-1.5 max-w-[20ch] text-sm leading-relaxed text-[#5b6472]">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function iconProps() {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 18 18",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  } as const;
}

function ProfileIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="9" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M3.8 14.5a5.2 5.2 0 0 1 10.4 0"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="2.5" y="5" width="9.5" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M12 8 15.5 5.5v7L12 10" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M5 2h5l3.5 3.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M6.5 9h5M6.5 11.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M5 13 13 5M7 5h6v6"
        stroke="currentColor"
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
      width="100%"
      height="12"
      viewBox="0 0 60 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M0 6h54M48 2l6 4-6 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
