import Image from "next/image";

const SIZES = {
  sm: { icon: 28, gap: "gap-2", wordmark: "text-lg" },
  md: { icon: 36, gap: "gap-2.5", wordmark: "text-xl" },
  lg: { icon: 72, gap: "gap-4", wordmark: "text-4xl" },
} as const;

// Source mark is 396x480 (w:h ratio 0.825), cropped from the brand logo.
const MARK_RATIO = 396 / 480;

export function LogoMark({ size = 28 }: { size?: number }) {
  const width = Math.round(size * MARK_RATIO);
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={width}
      height={size}
      priority
      className="shrink-0"
    />
  );
}

export function Logo({
  size = "md",
  showWordmark = true,
  onLight = false,
  className = "",
}: {
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  onLight?: boolean;
  className?: string;
}) {
  const cfg = SIZES[size];
  return (
    <span className={`inline-flex items-center ${cfg.gap} ${className}`}>
      <LogoMark size={cfg.icon} />
      {showWordmark && (
        <span
          className={`font-sans font-bold tracking-tight ${cfg.wordmark} ${
            onLight ? "text-[#0b1120]" : "text-foreground"
          }`}
        >
          GetMeHired
        </span>
      )}
    </span>
  );
}
