"use client";

import { createContext, useContext, useMemo } from "react";
import { ApiError } from "@/lib/api";
import { INTL_TAG, type Locale } from "./config";
import { DICTS } from "./dict";
import type { Dict } from "./en";

export interface I18n {
  locale: Locale;
  t: Dict;
  /** Whole number, locale-formatted ("2,350" / "2350"). */
  n: (v: number | null | undefined) => string;
  /** One decimal ("112.4" / "112,4"). */
  n1: (v: number | null | undefined) => string;
  /** Prefixes an app path with the locale: href("/today") → "/bg/today". */
  href: (path: string) => string;
  longDate: (iso: string) => string;
  shortDate: (iso: string) => string;
  /** Bulgarian name when available, else the English one. */
  pick: (en: string, bg?: string | null) => string;
  /** User-facing message for a failed request. `byStatus` overrides per screen. */
  errorText: (err: unknown, byStatus?: Partial<Record<number, string>>) => string;
}

const I18nContext = createContext<I18n | null>(null);

function build(locale: Locale): I18n {
  const t = DICTS[locale];
  const tag = INTL_TAG[locale];
  const nf0 = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(tag, { maximumFractionDigits: 1 });
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  return {
    locale,
    t,
    n: (v) => (v == null ? "–" : nf0.format(v)),
    n1: (v) => (v == null ? "–" : nf1.format(v)),
    href: (path) => `/${locale}${path === "/" ? "" : path}`,
    longDate: (iso) => parse(iso).toLocaleDateString(tag, { weekday: "long", month: "long", day: "numeric" }),
    shortDate: (iso) => parse(iso).toLocaleDateString(tag, { year: "numeric", month: "short", day: "numeric" }),
    pick: (enName, bgName) => (locale === "bg" && bgName ? bgName : enName),
    errorText: (err, byStatus) => {
      if (err instanceof ApiError) {
        if (byStatus?.[err.status]) return byStatus[err.status]!;
        if (err.status === 429) return t.errors.tooMany;
        if (err.status >= 500) return t.errors.network;
        // API validation messages are English; show them only in English.
        return locale === "en" ? err.message : t.errors.generic;
      }
      return t.errors.network;
    },
  };
}

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => build(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
