import type { SkillScores } from "@/lib/dashboard/performance";

/**
 * GetMeHired's recognizable score visualization: restrained horizontal
 * rails, not a colorful radial chart. Reused on Home, Analytics, and
 * (eventually) per-interview results.
 */
export function SkillBars({ scores, className = "" }: { scores: SkillScores; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Object.entries(scores).map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 text-sm text-[#5b6474]">{label}</span>
          <div className="h-1.5 flex-1 rounded-full bg-[#eef1f6]">
            <div
              className="h-1.5 rounded-full bg-accent transition-[width] duration-500 ease-out"
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-sm font-medium tabular-nums text-[#0b1120]">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
