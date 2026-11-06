/** A recipe as published by its source, before any nutrition estimate. */
export interface ScrapedRecipe {
  title: string;
  /** The source's own category label ("Ястия със свинско месо"); null = none on the page. */
  category: string | null;
  cuisine: string | null;
  /** Servings as stated by the source; null = not stated. */
  servings: number | null;
  /** One ingredient per line, as written. */
  ingredients: string[];
  /** Method paragraphs in order. */
  steps: string[];
}

/** Fetches a page body as text; null = the page is gone (404/410) or could not be fetched. */
export type FetchText = (url: string) => Promise<string | null>;

export interface RecipeSource {
  /** Stored as `recipes.source_name` and shown as the attribution. */
  name: string;
  host: string;
  /** Pages that are not UTF-8. */
  encoding?: 'windows-1251';
  /** Every recipe URL the source publishes (from its sitemaps). */
  listUrls(fetchText: FetchText): Promise<string[]>;
  /** null = the page is not a recipe (removed, redirected to a listing, malformed). */
  parse(html: string, url: string): ScrapedRecipe | null;
}

/** `<loc>` entries of a sitemap or sitemap index. */
export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

/** First integer in a servings string ("4 servings", "16 бр", "Порции: 6"); null = none. */
export function parseServings(text: string | null | undefined): number | null {
  const m = text?.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 60 ? n : null;
}

export const squash = (text: string): string => text.replace(/[\u00AD\u200B]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
