import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 text-center sm:px-6 lg:px-8">
        <Logo size="sm" />
        <p className="max-w-sm text-sm text-muted">
          Contextual interview practice, built at HackRice 2026.
        </p>
        <p className="text-xs text-muted">© 2026 GetMeHired.</p>
      </div>
    </footer>
  );
}
