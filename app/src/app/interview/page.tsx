import Link from "next/link";
import { CodeIcon, ChatCircleDotsIcon, ArrowRightIcon } from "@phosphor-icons/react/ssr";
import type { InterviewMode } from "@/lib/questions/types";

const MODES: {
  mode: InterviewMode;
  title: string;
  description: string;
  icon: typeof CodeIcon;
}[] = [
  {
    mode: "technical",
    title: "Technical",
    description: "Design decisions, debugging, and tradeoffs from your own projects.",
    icon: CodeIcon,
  },
  {
    mode: "behavioral",
    title: "Behavioral",
    description: "Teamwork, deadlines, and how you've handled real situations.",
    icon: ChatCircleDotsIcon,
  },
];

export default function InterviewModeSelect() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-10 px-4 py-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a practice mode</h1>
        <p className="text-sm text-zinc-500">
          Each session records one clip per question, on camera.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {MODES.map(({ mode, title, description, icon: Icon }) => (
          <Link
            key={mode}
            href={`/interview/${mode}`}
            className="group flex flex-col gap-4 rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-300 active:scale-[0.98] dark:border-zinc-800 dark:hover:border-zinc-700"
          >
            <Icon size={28} weight="light" />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{title}</span>
              <p className="text-sm text-zinc-500">{description}</p>
            </div>
            <span className="flex items-center gap-1 text-sm font-medium text-sky-600 dark:text-sky-400">
              Start
              <ArrowRightIcon size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
