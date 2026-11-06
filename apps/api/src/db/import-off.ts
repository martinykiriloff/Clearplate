import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { ExternalFood, normalizeOff } from '../foods/open-food-facts';
import { foods } from './schema';

const OFF_URL = process.env.OPEN_FOOD_FACTS_URL ?? 'https://world.openfoodfacts.org';
const PAGE_SIZE = 100;
// OFF asks search clients to stay under 10 requests a minute.
const PAGE_DELAY_MS = 6500;
const FIELDS = 'code,product_name,product_name_en,product_name_bg,brands,nutriments,serving_quantity';

interface SearchPage {
  count: number;
  products: Record<string, unknown>[];
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Same barcode shapes the scan endpoint accepts. */
export function isValidBarcode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{8}$|^\d{12,14}$/.test(code);
}

/** Normalises one search page, dropping products without a usable barcode or complete macros. */
export function normalizePage(products: Record<string, unknown>[]): ExternalFood[] {
  const out: ExternalFood[] = [];
  for (const p of products) {
    if (!isValidBarcode(p.code)) continue;
    const food = normalizeOff(p.code, p);
    if (food) out.push(food);
  }
  return out;
}

const MAX_ATTEMPTS = 15;
const MAX_BACKOFF_MS = 5 * 60_000;

/** OFF sheds load with 429/5xx; back off and retry those, fail fast on anything else. */
async function fetchPage(page: number): Promise<SearchPage> {
  const params = new URLSearchParams({
    countries_tags_en: 'bulgaria',
    // Most-scanned first, so a capped run still covers what people actually buy.
    sort_by: 'unique_scans_n',
    page_size: String(PAGE_SIZE),
    page: String(page),
    fields: FIELDS,
  });
  for (let attempt = 1; ; attempt++) {
    const res = await fetchOnce(params);
    if (res?.ok) return (await res.json()) as SearchPage;
    // No response (timeout, reset) is as transient as a 429/5xx.
    const isTransient = res === null || res.status === 429 || res.status >= 500;
    if (!isTransient || attempt === MAX_ATTEMPTS) throw new Error(`Open Food Facts search page ${page} failed: ${res?.status ?? 'no response'}`);
    await sleep(Math.min(PAGE_DELAY_MS * 2 ** attempt, MAX_BACKOFF_MS));
  }
}

/** One search request; null when the network gave no response at all. */
async function fetchOnce(params: URLSearchParams): Promise<Response | null> {
  try {
    return await fetch(`${OFF_URL}/api/v2/search?${params}`, {
      headers: { 'User-Agent': 'Clearplate/0.1 (https://github.com/martinykiriloff/Clearplate)' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return null;
  }
}

/**
 * Imports Bulgarian products from Open Food Facts (ODbL) into the catalogue.
 * Idempotent: an existing catalogue barcode is left untouched, so verified or
 * hand-corrected rows are never overwritten. Imported rows stay `verified: false`.
 */
export async function importOff(databaseUrl: string, options: { maxPages: number; startPage?: number }): Promise<{ seen: number; inserted: number }> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool);
  let seen = 0;
  let inserted = 0;
  try {
    for (let page = options.startPage ?? 1; page <= options.maxPages; page++) {
      const { count, products } = await fetchPage(page);
      if (products.length === 0) break;
      const rows = normalizePage(products).map((f) => ({
        name: f.name,
        nameBg: f.nameBg,
        brand: f.brand,
        barcode: f.barcode,
        kcal: f.kcal,
        proteinG: f.proteinG,
        fatG: f.fatG,
        carbsG: f.carbsG,
        fiberG: f.fiberG,
        sugarG: f.sugarG,
        satFatG: f.satFatG,
        sodiumMg: f.sodiumMg,
        micros: f.micros,
        servingG: f.servingG,
        source: 'open_food_facts' as const,
        verified: false,
      }));
      seen += products.length;
      if (rows.length) {
        const res = await db.insert(foods).values(rows).onConflictDoNothing().returning({ id: foods.id });
        inserted += res.length;
      }
      console.log(`page ${page}: ${seen}/${count} seen, ${inserted} new`);
      if (page * PAGE_SIZE >= count) break;
      await sleep(PAGE_DELAY_MS);
    }
    return { seen, inserted };
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  // One page is 100 products; OFF_MAX_PAGES=0 means no cap.
  const maxPages = Number(process.env.OFF_MAX_PAGES ?? 50) || Number.MAX_SAFE_INTEGER;
  importOff(url, { maxPages, startPage: Number(process.env.OFF_START_PAGE ?? 1) })
    .then((r) => console.log(`Import done: ${r.inserted} new of ${r.seen} seen`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
