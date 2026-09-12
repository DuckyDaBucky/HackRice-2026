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
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M20,85 L38,85 L75,30 L83,22 L92,8 L49,34 L57,30 Z"
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
