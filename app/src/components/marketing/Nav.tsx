"use client";

import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { clerkEnabled } from "@/lib/clerk";
import { Logo } from "./Logo";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#workspaces", label: "For candidates" },
  { href: "#workspaces", label: "For employers" },
  { href: "#trust", label: "Trust" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#top" className="shrink-0">
          <Logo size="sm" />
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          {clerkEnabled && (
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="text-sm text-muted transition-colors hover:text-foreground">
                  Log in
                </button>
              </SignInButton>
            </Show>
          )}
          {clerkEnabled && (
            <Show when="signed-in">
              <UserButton />
            </Show>
          )}
          <a
            href="#waitlist"
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-[#03231e] transition-colors hover:bg-accent-hover"
          >
            Join waitlist
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground lg:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <MenuIcon open={open} />
        </button>
      </div>

      {open && (
        <div className="border-t border-border px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm text-muted hover:bg-surface hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
            {clerkEnabled && (
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="text-sm text-muted hover:text-foreground">
                    Log in
                  </button>
                </SignInButton>
              </Show>
            )}
            {clerkEnabled && (
              <Show when="signed-in">
                <UserButton />
              </Show>
            )}
            <a
              href="#waitlist"
              onClick={() => setOpen(false)}
              className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-[#03231e]"
            >
              Join waitlist
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {open ? (
        <path
          d="M5 5L15 15M15 5L5 15"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M3 6H17M3 10H17M3 14H17"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
