"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { useRequireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/diary", label: "Diary" },
  { href: "/recipes", label: "Recipes" },
  { href: "/progress", label: "Progress" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, failed, mutate } = useRequireUser();

  return (
    <div className="flex flex-1 flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <Logo href="/today" />
          <nav aria-label="Main" className="flex flex-wrap gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-lg px-4 text-[15px] transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    active ? "bg-secondary font-semibold text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/settings"
            className={cn(
              "ml-auto inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              pathname === "/settings" && "text-primary",
            )}
          >
            {user?.name ?? user?.email ?? "Account"}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {user ? (
          children
        ) : failed ? (
          <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6">
            <p>We couldn&apos;t reach Clearplate. Check your connection and try again.</p>
            <button
              type="button"
              onClick={() => void mutate()}
              className="inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Try again
            </button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
