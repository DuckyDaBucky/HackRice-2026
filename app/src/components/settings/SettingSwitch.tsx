"use client";

/** Accessible on/off switch: real button + role=switch, motion limited to transform. */
export function SettingSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-dash-border bg-dash-surface px-4 py-3.5 text-left transition-colors duration-150 hover:bg-dash-surface-hover"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-dash-text">{label}</span>
        <span className="text-xs leading-relaxed text-dash-text-muted">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150 ${checked ? "bg-accent" : "bg-dash-border-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}
