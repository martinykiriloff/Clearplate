"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

/** Brand mark. `path` is locale-free ("/today"); the locale prefix is added here. */
export function Logo({ path = "/", className }: { path?: string; className?: string }) {
  const { href } = useI18n();
  return (
    <Link href={href(path)} className={cn("inline-flex items-center gap-2 rounded-md text-lg font-bold tracking-tight focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--primary)" strokeWidth="3" />
        <path d="M16 5v11h11" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      Clearplate
    </Link>
  );
}
