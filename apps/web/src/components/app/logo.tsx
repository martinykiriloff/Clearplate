import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-md text-lg font-bold tracking-tight focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--primary)" strokeWidth="3" />
        <path d="M16 5v11h11" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      Clearplate
    </Link>
  );
}
