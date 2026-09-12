import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold">HackRice 2026</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Sign in or sign up to get started.
      </p>
      <Link
        href="/interview"
        className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
      >
        Start interview practice
      </Link>
    </div>
  );
}
