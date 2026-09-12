const SIZES = {
  sm: { icon: 28, gap: "gap-2", wordmark: "text-lg" },
  md: { icon: 36, gap: "gap-2.5", wordmark: "text-xl" },
  lg: { icon: 72, gap: "gap-4", wordmark: "text-4xl" },
} as const;

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 33.5C6 33.5 13 34.5 17 30C19.0787 27.6459 19.5 24.5 19.5 24.5V33.5H12.5C9.73858 33.5 7.5 33.5 6 33.5Z"
        fill="var(--color-accent-deep)"
      />
      <path
        d="M10 33 L10 25 L25 10 L25 5 L34 5 L34 14 L21 27 L21 33 Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}

export function Logo({
  size = "md",
  showWordmark = true,
  className = "",
}: {
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  className?: string;
}) {
  const cfg = SIZES[size];
  return (
    <span className={`inline-flex items-center ${cfg.gap} ${className}`}>
      <LogoMark size={cfg.icon} />
      {showWordmark && (
        <span
          className={`font-sans font-bold tracking-tight text-foreground ${cfg.wordmark}`}
        >
          GetMeHired
        </span>
      )}
    </span>
  );
}
