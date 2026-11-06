import { resolve } from 'node:path';
import { eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { foods, MealType, recipes } from '../db/schema';
import { HostCrawler } from './crawler';
import { classifyMeal, isNotFood, portionGramsFor } from './meal-type';
import { estimateRecipe, estimateServings, FoodMacros, perServing, RecipeEstimate } from './recipe-nutrition';
import { RECIPE_SOURCES } from './sources';
import type { RecipeSource, ScrapedRecipe } from './sources/types';

export interface ImportOptions {
  sources: readonly RecipeSource[];
  /** Recipes to import per source in this run; new URLs first, already imported ones are skipped unless `refresh`. */
  limit: number;
  delayMs: number;
  /** Minimum share of the ingredient mass that must be matched to the catalogue. */
  minCoverage: number;
  cacheDir: string;
  offline: boolean;
  /** Re-parse and overwrite recipes that are already imported (after dictionary or parser fixes). */
  refresh: boolean;
  dryRun: boolean;
  /** Also log every recipe that was rejected and why. */
  verbose: boolean;
  log: (message: string) => void;
}

export interface SourceReport {
  source: string;
  skippedHost: string | null;
  listed: number;
  fetched: number;
  notRecipe: number;
  lowCoverage: number;
  implausible: number;
  imported: number;
  /** Previously imported recipes deleted by a refresh because they no longer pass. */
  removed: number;
  unmatched: Map<string, number>;
  /** Set when the source aborted; the other sources still finish. */
  error: string | null;
}

type RecipeInsert = typeof recipes.$inferInsert;

const KCAL_PER_SERVING = { min: 5, max: 2500 };
/** "1 serving" on a sauce or glaze means one batch; above this much energy we estimate the portions ourselves. */
const ONE_SERVING_MAX_KCAL = 900;
/** Nobody eats this much in one sitting; beyond it the amounts or the servings are wrong. */
const MAX_PER_SERVING = { proteinG: 150, fatG: 200, carbsG: 400 };
/** When servings are our guess, a portion is also capped by energy: a plate is rarely more than this. */
const MAX_KCAL_PER_ESTIMATED_SERVING = 900;
const BATCH = 50;

/** Turns a scraped recipe into a catalogue row, or explains why it cannot be imported. */
export function buildRecipeRow(
  scraped: ScrapedRecipe,
  url: string,
  sourceName: string,
  catalogue: ReadonlyMap<string, FoodMacros>,
  minCoverage: number,
): { kind: 'ok'; row: RecipeInsert; estimate: RecipeEstimate } | { kind: 'not_recipe' } | { kind: 'low_coverage'; estimate: RecipeEstimate } | { kind: 'implausible'; estimate: RecipeEstimate } {
  if (scraped.ingredients.length < 2 || scraped.steps.length === 0 || isNotFood(scraped.title)) return { kind: 'not_recipe' };
  const estimate = estimateRecipe(scraped.ingredients, catalogue);
  if (estimate.coverage < minCoverage || estimate.matchedG <= 0) return { kind: 'low_coverage', estimate };

  const mealType: MealType = classifyMeal(scraped.title, scraped.category);
  const byWeight = estimateServings(estimate.knownG, portionGramsFor(mealType, scraped.title, scraped.category));
  const byEnergy = estimateServings(estimate.total.kcal, MAX_KCAL_PER_ESTIMATED_SERVING);
  const statedServings = scraped.servings === 1 && estimate.total.kcal > ONE_SERVING_MAX_KCAL ? null : scraped.servings;
  const servings = statedServings ?? Math.max(byWeight, byEnergy);
  const macros = perServing(estimate.total, servings);
  if (macros.kcal < KCAL_PER_SERVING.min || macros.kcal > KCAL_PER_SERVING.max) return { kind: 'implausible', estimate };
  if (macros.proteinG > MAX_PER_SERVING.proteinG || macros.fatG > MAX_PER_SERVING.fatG || macros.carbsG > MAX_PER_SERVING.carbsG) return { kind: 'implausible', estimate };

  const ingredients = scraped.ingredients.join(', ');
  const method = scraped.steps.join(' ');
  const row: RecipeInsert = {
    // The sources are Bulgarian only; the English column carries the same text so search and display never show an empty name.
    name: scraped.title,
    nameBg: scraped.title,
    mealType,
    base: scraped.category,
    cuisine: scraped.cuisine,
    ingredients,
    ingredientsBg: ingredients,
    method,
    methodBg: method,
    servings,
    ...macros,
    micros: null,
    sourceName,
    sourceUrl: url,
    estimateCoverage: Math.round(estimate.coverage * 1000) / 1000,
    ownerId: null,
  };
  return { kind: 'ok', row, estimate };
}

async function loadCatalogue(db: NodePgDatabase): Promise<Map<string, FoodMacros>> {
  const rows = await db
    .select({
      name: foods.name,
      kcal: foods.kcal,
      proteinG: foods.proteinG,
      fatG: foods.fatG,
      carbsG: foods.carbsG,
      fiberG: foods.fiberG,
      sugarG: foods.sugarG,
      satFatG: foods.satFatG,
      sodiumMg: foods.sodiumMg,
    })
    .from(foods)
    .where(eq(foods.source, 'seed'));
  return new Map(rows.map(({ name, ...macros }) => [name, macros]));
}

async function upsertRows(db: NodePgDatabase, rows: RecipeInsert[]): Promise<number> {
  if (!rows.length) return 0;
  const excluded = (column: string) => sql.raw(`excluded."${column}"`);
  const res = await db
    .insert(recipes)
    .values(rows)
    .onConflictDoUpdate({
      target: recipes.sourceUrl,
      targetWhere: sql`${recipes.sourceUrl} is not null`,
      set: {
        name: excluded('name'),
        nameBg: excluded('name_bg'),
        mealType: excluded('meal_type'),
        base: excluded('base'),
        cuisine: excluded('cuisine'),
        ingredients: excluded('ingredients'),
        ingredientsBg: excluded('ingredients_bg'),
        method: excluded('method'),
        methodBg: excluded('method_bg'),
        servings: excluded('servings'),
        kcal: excluded('kcal'),
        proteinG: excluded('protein_g'),
        fatG: excluded('fat_g'),
        carbsG: excluded('carbs_g'),
        fiberG: excluded('fiber_g'),
        sugarG: excluded('sugar_g'),
        satFatG: excluded('sat_fat_g'),
        sodiumMg: excluded('sodium_mg'),
        estimateCoverage: excluded('estimate_coverage'),
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: recipes.id });
  return res.length;
}

async function importSource(db: NodePgDatabase, source: RecipeSource, catalogue: ReadonlyMap<string, FoodMacros>, options: ImportOptions): Promise<SourceReport> {
  const report: SourceReport = { source: source.name, skippedHost: null, listed: 0, fetched: 0, notRecipe: 0, lowCoverage: 0, implausible: 0, imported: 0, removed: 0, unmatched: new Map(), error: null };
  const log = (m: string) => options.log(`[${source.name}] ${m}`);
  const crawler = new HostCrawler(source.host, { cacheDir: options.cacheDir, delayMs: options.delayMs, encoding: source.encoding, offline: options.offline, log });

  report.skippedHost = await crawler.init();
  if (report.skippedHost) {
    log(`skipped: ${report.skippedHost}`);
    return report;
  }

  const all = await source.listUrls((u) => crawler.fetchText(u));
  report.listed = all.length;
  const done = new Set(
    options.refresh ? [] : (await db.select({ url: recipes.sourceUrl }).from(recipes).where(eq(recipes.sourceName, source.name))).map((r) => r.url).filter((u): u is string => u != null),
  );
  const todo = all.filter((u) => !done.has(u)).slice(0, options.limit);
  log(`${all.length} recipes listed, ${done.size} already imported, importing up to ${todo.length} (delay ${options.delayMs} ms)`);

  let batch: RecipeInsert[] = [];
  const rejected: string[] = [];
  const flush = async () => {
    if (!options.dryRun) report.imported += await upsertRows(db, batch);
    else report.imported += batch.length;
    batch = [];
  };

  for (const [i, url] of todo.entries()) {
    const html = await crawler.fetchText(url);
    if (!html) continue;
    report.fetched++;
    const scraped = source.parse(html, url);
    if (!scraped) {
      report.notRecipe++;
      rejected.push(url);
      continue;
    }
    const built = buildRecipeRow(scraped, url, source.name, catalogue, options.minCoverage);
    if (built.kind !== 'not_recipe') {
      for (const ing of built.estimate.ingredients) {
        if (ing.kind === 'no_food' && ing.parsed.name) report.unmatched.set(ing.parsed.name, (report.unmatched.get(ing.parsed.name) ?? 0) + 1);
      }
    }
    if (built.kind !== 'ok') rejected.push(url);
    if (built.kind === 'not_recipe') report.notRecipe++;
    else if (built.kind === 'low_coverage') {
      report.lowCoverage++;
      if (options.verbose) log(`low coverage ${built.estimate.coverage.toFixed(2)}: ${url}`);
    } else if (built.kind === 'implausible') {
      report.implausible++;
      if (options.verbose) log(`implausible (${Math.round(built.estimate.total.kcal)} kcal total, ${scraped.servings ?? 'est.'} servings): ${url}`);
    } else batch.push(built.row);
    if (batch.length >= BATCH) await flush();
    if ((i + 1) % 100 === 0) log(`${i + 1}/${todo.length}: ${report.imported + batch.length} imported, ${report.lowCoverage} low coverage, ${report.implausible} implausible, ${report.notRecipe} not recipes`);
  }
  await flush();
  // After a parser or threshold change a refresh must also drop recipes that no longer pass.
  if (options.refresh && !options.dryRun) {
    for (let i = 0; i < rejected.length; i += BATCH) {
      const res = await db.delete(recipes).where(inArray(recipes.sourceUrl, rejected.slice(i, i + BATCH))).returning({ id: recipes.id });
      report.removed += res.length;
    }
  }
  const c = crawler.stats;
  log(`done: ${report.imported} imported of ${report.fetched} fetched${report.removed ? `, ${report.removed} stale removed` : ''} (${c.fetched} from the network, ${c.fromCache} from cache, ${c.missing} gone, ${c.errors} errors)`);
  return report;
}

/** Imports recipes from every source concurrently (one host each), politely. */
export async function importRecipes(databaseUrl: string, options: ImportOptions): Promise<SourceReport[]> {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const db = drizzle(pool);
  try {
    const catalogue = await loadCatalogue(db);
    if (!catalogue.has('Wheat flour, white')) throw new Error('The cooking ingredients are not seeded yet: run `pnpm --filter @clearplate/api seed` first');
    const existing = await db.select({ n: sql<number>`count(*)` }).from(recipes).where(isNotNull(recipes.sourceUrl));
    options.log(`${catalogue.size} catalogue foods, ${existing[0]?.n ?? 0} imported recipes before this run`);
    // One failing host must not abort the others, and the pool must stay open until every source is done
    // (hence `return await`: a bare `return` would run `finally` before the sources finish).
    return await Promise.all(
      options.sources.map((s) =>
        importSource(db, s, catalogue, options).catch((err: unknown) => {
          const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
          options.log(`[${s.name}] aborted: ${message}`);
          const failed: SourceReport = { source: s.name, skippedHost: null, listed: 0, fetched: 0, notRecipe: 0, lowCoverage: 0, implausible: 0, imported: 0, removed: 0, unmatched: new Map(), error: message };
          return failed;
        }),
      ),
    );
  } finally {
    await pool.end();
  }
}

/** Debug aid: shows how every ingredient line of one recipe was read, matched and weighed. */
export async function explainRecipe(databaseUrl: string, url: string, options: ImportOptions): Promise<void> {
  const source = RECIPE_SOURCES.find((s) => new URL(url).hostname.replace(/^www\./, '') === s.host.replace(/^www\./, ''));
  if (!source) throw new Error(`No source for ${url}`);
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const catalogue = await loadCatalogue(drizzle(pool));
    const crawler = new HostCrawler(source.host, { cacheDir: options.cacheDir, delayMs: options.delayMs, encoding: source.encoding, offline: options.offline, log: options.log });
    const html = await crawler.fetchText(url);
    const scraped = html ? source.parse(html, url) : null;
    if (!scraped) {
      console.log('not a recipe page');
      return;
    }
    const built = buildRecipeRow(scraped, url, source.name, catalogue, options.minCoverage);
    console.log(`${scraped.title} | category ${scraped.category} | cuisine ${scraped.cuisine} | servings ${scraped.servings ?? 'n/a'} | steps ${scraped.steps.length}`);
    if (built.kind === 'not_recipe') {
      console.log('not a recipe (too few ingredients or no method)');
      return;
    }
    for (const ing of built.estimate.ingredients) {
      const p = ing.parsed;
      const amount = `${p.quantity ?? '-'} ${p.unit ?? ''}`.trim();
      if (ing.kind === 'matched') console.log(`  ✓ ${p.raw}  →  ${amount} "${p.name}" → ${ing.food} ${Math.round(ing.grams)} g`);
      else if (ing.kind === 'no_food') console.log(`  ✗ ${p.raw}  →  ${amount} "${p.name}" → NO FOOD${ing.grams != null ? ` (${Math.round(ing.grams)} g known)` : ''}`);
      else if (ing.kind === 'no_amount') console.log(`  ? ${p.raw}  →  "${p.name}" → ${ing.food}, amount unknown`);
      else console.log(`  # ${p.raw}`);
    }
    const e = built.estimate;
    console.log(`coverage ${e.coverage.toFixed(2)} (${Math.round(e.matchedG)} g matched of ${Math.round(e.knownG)} g known) → ${built.kind}`);
    if (built.kind === 'ok') console.log(`${built.row.mealType}, ${built.row.servings} servings, per serving ${built.row.kcal} kcal, P ${built.row.proteinG} F ${built.row.fatG} C ${built.row.carbsG}`);
    else console.log(`total ${Math.round(e.total.kcal)} kcal`);
  } finally {
    await pool.end();
  }
}

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function printUnmatched(reports: SourceReport[], top: number): void {
  const merged = new Map<string, number>();
  for (const r of reports) for (const [name, n] of r.unmatched) merged.set(name, (merged.get(name) ?? 0) + n);
  const rows = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  if (!rows.length) return;
  console.log(`\nMost frequent ingredients without a catalogue match (add them to ingredient-dictionary.ts):`);
  for (const [name, n] of rows) console.log(`  ${String(n).padStart(5)}  ${name}`);
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const wanted = argValue('source') ?? 'all';
  const sources = wanted === 'all' ? RECIPE_SOURCES : RECIPE_SOURCES.filter((s) => s.name === wanted || s.name.startsWith(wanted));
  if (!sources.length) {
    console.error(`Unknown source "${wanted}". Known: ${RECIPE_SOURCES.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }
  const options: ImportOptions = {
    sources,
    // A refresh re-parses the whole catalogue unless told otherwise; a crawl defaults to a small polite batch.
    limit: Number(argValue('limit') ?? (process.argv.includes('--refresh') ? Infinity : 200)),
    delayMs: Number(argValue('delay-ms') ?? 1500),
    minCoverage: Number(argValue('min-coverage') ?? 0.6),
    cacheDir: resolve(__dirname, '../../.import-cache'),
    offline: process.argv.includes('--offline'),
    refresh: process.argv.includes('--refresh'),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose'),
    log: (m) => console.log(`${new Date().toISOString().slice(11, 19)} ${m}`),
  };
  const explain = argValue('explain');
  (explain ? explainRecipe(url, explain, options).then(() => []) : importRecipes(url, options))
    .then((reports) => {
      for (const r of reports) {
        console.log(`\n${r.source}: ${r.error ? `aborted: ${r.error.split('\n')[0]}` : r.skippedHost ?? `${r.imported} imported, ${r.lowCoverage} low coverage, ${r.implausible} implausible, ${r.notRecipe} not recipes${r.removed ? `, ${r.removed} stale removed` : ''} (${r.fetched} fetched of ${r.listed} listed)`}`);
      }
      printUnmatched(reports, Number(argValue('report-unmatched') ?? 40));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
