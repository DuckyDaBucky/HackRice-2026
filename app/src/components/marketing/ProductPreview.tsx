import Image from "next/image";

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
      <Image
        src="/hero-preview.png"
        alt="GetMeHired practice interview in progress, showing the candidate's camera feed alongside the AI interviewer and the current technical question"
        width={1681}
        height={935}
        priority
        className="h-auto w-full"
      />
    </div>
  );
}
