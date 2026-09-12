import Link from "next/link";

export default function InterviewModeSelect() {
  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <h1 className="text-2xl font-semibold">Choose a practice mode</h1>
      <div className="flex gap-4">
        <Link
          href="/interview/technical"
          className="rounded-full bg-foreground px-6 py-3 font-medium text-background"
        >
          Technical
        </Link>
        <Link
          href="/interview/behavioral"
          className="rounded-full border border-zinc-300 px-6 py-3 font-medium dark:border-zinc-700"
        >
          Behavioral
        </Link>
      </div>
    </div>
  );
}
