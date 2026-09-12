import { Logo } from "./Logo";

const PRODUCT_LINKS = [
  { href: "#product", label: "Overview" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#workspaces", label: "Workspaces" },
  { href: "#trust", label: "Trust" },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="max-w-xs">
            <Logo size="sm" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Interview practice and employer screening, grounded in
              evidence.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Product</p>
            <ul className="mt-3 flex flex-col gap-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 GetMeHired</span>
          <span>Built at HackRice 2026</span>
        </div>
      </div>
    </footer>
  );
}
