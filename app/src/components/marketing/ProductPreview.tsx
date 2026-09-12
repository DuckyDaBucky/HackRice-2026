import { LogoMark } from "./Logo";

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <LogoMark size={18} />
          <span className="text-sm font-medium text-foreground">
            GetMeHired
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400/80" />
            Interview in progress
          </span>
          <span className="font-mono text-xs text-muted">08:42</span>
          <span className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300">
            End interview
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-[1.1fr_1fr]">
        <div className="flex items-center justify-center bg-bg-elevated py-14">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-border text-sm font-medium text-foreground">
            JD
          </div>
        </div>

        <div className="bg-surface px-5 py-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Technical question</p>
            <span className="font-mono text-xs text-muted">2 / 8</span>
          </div>
          <p className="mt-1.5 text-base font-medium leading-snug text-foreground">
            Can you walk me through a project you&rsquo;re proud of from your
            resume?
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border/70 bg-bg-elevated px-3 py-2.5">
            <TipIcon />
            <p className="text-xs leading-relaxed text-muted">
              Use the STAR method (Situation, Task, Action, Result) and be
              specific.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted">
          Hide question
        </span>
        <div className="flex items-center gap-3 text-muted">
          <MicIcon />
          <CameraIcon />
          <SettingsIcon />
          <span className="flex items-end gap-0.5">
            <span className="h-2 w-0.5 rounded-full bg-accent" />
            <span className="h-3 w-0.5 rounded-full bg-accent" />
            <span className="h-1.5 w-0.5 rounded-full bg-accent" />
          </span>
        </div>
      </div>
    </div>
  );
}

function iconProps() {
  return {
    width: 15,
    height: 15,
    viewBox: "0 0 16 16",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  } as const;
}

function TipIcon() {
  return (
    <svg {...iconProps()} className="mt-0.5 shrink-0 text-accent">
      <path
        d="M8 1.5a4 4 0 0 0-2.2 7.3c.4.3.7.8.7 1.3v.4h3v-.4c0-.5.3-1 .7-1.3A4 4 0 0 0 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M6.5 13h3M7 14.5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="6" y="1.5" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M4 7.5a4 4 0 0 0 8 0M8 11.5V14"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="1.5" y="4" width="9" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M10.5 6.8 14.5 4.5v7L10.5 9.2"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.3 3.7l-1 1M4.7 11.3l-1 1M12.3 12.3l-1-1M4.7 4.7l-1-1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
