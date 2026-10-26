"use client";

import { usePathname } from "next/navigation";
import { mutate } from "swr";
import { LOCALE_NAME, LOCALES, splitLocale, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/provider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * EN | BG toggle. Keeps the current page, saves the choice to the profile when
 * signed in (the proxy also remembers it in a cookie), and reloads so every
 * server-rendered string switches too.
 */
export function LocaleSwitch({ signedIn = false, className }: { signedIn?: boolean; className?: string }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const { rest } = splitLocale(pathname);

  async function choose(next: Locale) {
    if (next === locale) return;
    if (signedIn) {
      await api("/auth/me", { method: "PATCH", json: { locale: next } }).catch(() => undefined);
      await mutate("/auth/me");
    }
    // Full reload on purpose: server-rendered strings and <html lang> must switch too.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${next}${rest === "/" ? "" : rest}${window.location.search}`);
  }

  return (
    <div role="group" aria-label={t.common.language} className={cn("inline-flex rounded-full border border-input p-0.5", className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          aria-label={LOCALE_NAME[l]}
          onClick={() => void choose(l)}
          className={cn(
            "inline-flex h-10 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold uppercase transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            l === locale ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
