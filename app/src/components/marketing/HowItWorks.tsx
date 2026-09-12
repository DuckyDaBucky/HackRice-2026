const STEPS = [
  { label: "Resume", icon: DocIcon },
  { label: "Target role", icon: TargetIcon },
  { label: "Mock interview", icon: CameraIcon },
  { label: "Evidence-backed feedback", icon: CheckIcon },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3">
                <step.icon />
                <span className="text-sm font-medium text-foreground">
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && <ArrowIcon />}
            </div>
          ))}
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
    className: "shrink-0 text-accent",
  } as const;
}

function DocIcon() {
  return (
    <svg {...iconProps()}>
      <path
        d="M4 1.5h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M6 8h4M6 10.5h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...iconProps()}>
      <rect
        x="1.5"
        y="4"
        width="9"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M10.5 6.8 14.5 4.5v7L10.5 9.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M5.2 8.2 7.1 10l3.7-4"
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
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="hidden shrink-0 text-muted/60 sm:block"
    >
      <path
        d="M2 8h11M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
