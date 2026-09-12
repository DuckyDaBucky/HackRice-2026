import Link from "next/link";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  icon: PhosphorIcon;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-[#eef1f6] bg-[#f9fafb] px-6 py-9 text-center">
      <Icon size={20} weight="light" className="mb-1 text-[#b7c0cc]" />
      <p className="text-sm font-medium text-[#0b1120]">{title}</p>
      <p className="max-w-xs text-sm text-[#6b7280]">{body}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-3 inline-flex h-8 items-center rounded-md bg-accent px-3.5 text-sm font-semibold text-[#03231e] transition-colors duration-150 hover:bg-accent-hover"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
