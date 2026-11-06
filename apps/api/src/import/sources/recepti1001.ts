import { CheerioAPI, load } from 'cheerio';
import { FetchText, parseServings, RecipeSource, ScrapedRecipe, sitemapLocs, squash } from './types';

interface HowToStep {
  text?: unknown;
}

interface JsonLdRecipe {
  '@type'?: unknown;
  name?: unknown;
  recipeYield?: unknown;
  recipeCategory?: unknown;
  recipeCuisine?: unknown;
  recipeIngredient?: unknown;
  recipeInstructions?: unknown;
}

const str = (v: unknown): string | null => (typeof v === 'string' && squash(v) ? squash(v) : null);

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => s != null) : []);

const stepTexts = (v: unknown): string[] =>
  Array.isArray(v)
    ? v
        .map((s: unknown) => (typeof s === 'string' ? s : typeof s === 'object' && s != null ? (s as HowToStep).text : null))
        .map(str)
        .filter((s): s is string => s != null)
    : typeof v === 'string'
      ? [squash(v)]
      : [];

/**
 * 1001recepti.com: windows-1251 pages with a schema.org JSON-LD Recipe block. Its
 * `nutrition` object holds placeholder values (32767 calories on every page), so it is ignored
 * and the macros are estimated from the ingredients like everywhere else.
 */
export const recepti1001: RecipeSource = {
  name: '1001recepti.com',
  host: 'www.1001recepti.com',
  encoding: 'windows-1251',

  async listUrls(fetchText: FetchText): Promise<string[]> {
    const xml = await fetchText('https://www.1001recepti.com/sitemap.xml');
    if (!xml) return [];
    return sitemapLocs(xml).filter((u) => u.includes('recipe_id='));
  },

  parse(html: string): ScrapedRecipe | null {
    const $ = load(html);
    let recipe: JsonLdRecipe | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (recipe) return;
      try {
        // Instructions contain raw line breaks inside strings, which strict JSON rejects.
        const data: unknown = JSON.parse($(el).text().replace(/[\u0000-\u001f]+/g, ' '));
        if (typeof data === 'object' && data != null && (data as JsonLdRecipe)['@type'] === 'Recipe') recipe = data as JsonLdRecipe;
      } catch {
        // Not every block on the page is valid JSON (ad scripts); the Recipe block is.
      }
    });
    if (!recipe) return parseHtml($);
    const found: JsonLdRecipe = recipe;
    const title = str(found.name);
    if (!title) return null;
    return {
      title,
      category: str(found.recipeCategory),
      cuisine: str(found.recipeCuisine),
      servings: parseServings(str(found.recipeYield)),
      ingredients: strings(found.recipeIngredient),
      steps: stepTexts(found.recipeInstructions),
    };
  },
};

/** About one page in six has no JSON-LD block; the markup still carries everything. */
function parseHtml($: CheerioAPI): ScrapedRecipe | null {
  const title = squash($('h1').first().text());
  const rows = $('ul.recipe_ingr li');
  if (!title || !rows.length) return null;
  const ingredients: string[] = [];
  rows.each((_, li) => {
    const amount = squash($(li).find('span span').first().text());
    const name = squash($(li).find('a').first().text()) || squash($(li).text()).replace(amount, '').trim();
    if (name) ingredients.push(amount ? `${amount} ${name}` : name);
  });
  const steps: string[] = [];
  $('p.recipe_step').each((_, el) => {
    const text = squash($(el).text());
    if (text) steps.push(text);
  });
  const servings = parseServings($('select[name="servings_combo"] option[selected]').first().text());
  const category = squash($('nav[aria-label="Breadcrumb"] a').first().text()) || null;
  return { title, category, cuisine: null, servings, ingredients, steps };
}
