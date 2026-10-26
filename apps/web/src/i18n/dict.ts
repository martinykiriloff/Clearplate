import { bg } from "./bg";
import { isLocale, type Locale } from "./config";
import { en, type Dict } from "./en";

export const DICTS: Record<Locale, Dict> = { en, bg };

/** Dictionary for server code (metadata). Unknown locales fall back to English. */
export function dictFor(locale: string): Dict {
  return DICTS[isLocale(locale) ? locale : "en"];
}
