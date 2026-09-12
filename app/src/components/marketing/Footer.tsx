import { Logo } from "./Logo";

const LINKS = [
  { href: "#individuals", label: "For Individuals" },
  { href: "#employers", label: "For Employers" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#waitlist", label: "Pricing" },
];

export function Footer() {
  return (
    <footer className="border-t border-[#e5e7eb] bg-[#fafbfc]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <Logo size="sm" onLight />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[#5b6472] transition-colors hover:text-[#0b1120]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-[#e5e7eb] pt-6 text-xs text-[#8a92a0] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 GetMeHired. All rights reserved.</span>
          <span>Built at HackRice 2026</span>
        </div>
      </div>
    </footer>
  );
}
