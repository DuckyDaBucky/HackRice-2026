export function Sparkline({
  values,
  width = 100,
  height = 32,
  showDots = false,
}: {
  values: number[];
  width?: number;
  height?: number;
  showDots?: boolean;
}) {
  const pad = 5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((v, i) => ({
    x: pad + (i / (values.length - 1 || 1)) * (width - pad * 2),
    y: height - pad - ((v - min) / range) * (height - pad * 2),
  }));
  const points = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots &&
        coords.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === coords.length - 1 ? 3 : 2}
            fill={i === coords.length - 1 ? "var(--color-accent)" : "white"}
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
        ))}
    </svg>
  );
}
