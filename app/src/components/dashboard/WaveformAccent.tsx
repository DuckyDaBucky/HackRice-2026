const HEIGHTS = [14, 24, 18, 32, 22, 38, 20, 30, 16, 26, 12];

/** Restrained, on-brand decoration for the hero panel — an audio-waveform motif, not a gradient blob. */
export function WaveformAccent({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-end gap-1.5 ${className}`} aria-hidden="true">
      {HEIGHTS.map((h, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-accent"
          style={{ height: h, opacity: 0.18 + (i % 3) * 0.08 }}
        />
      ))}
    </div>
  );
}
