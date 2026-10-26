export const LOCALES = ["en", "bg"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
/** Remembers the visitor's language between visits (set by proxy.ts). */
export const LOCALE_COOKIE = "cp_locale";

export const isLocale = (value: string | undefined | null): value is Locale => !!value && (LOCALES as readonly string[]).includes(value);

/** BCP 47 tags for Intl number and date formatting. */
export const INTL_TAG: Record<Locale, string> = { en: "en-US", bg: "bg-BG" };

export const LOCALE_NAME: Record<Locale, string> = { en: "English", bg: "Български" };

/** Picks a supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.map((r) => r.lang).find(isLocale) ?? DEFAULT_LOCALE;
}

/** Splits "/bg/today" into { locale: "bg", rest: "/today" }. */
export function splitLocale(pathname: string): { locale: Locale | null; rest: string } {
  const [, first, ...tail] = pathname.split("/");
  if (isLocale(first)) return { locale: first, rest: `/${tail.join("/")}`.replace(/\/$/, "") || "/" };
  return { locale: null, rest: pathname };
}
