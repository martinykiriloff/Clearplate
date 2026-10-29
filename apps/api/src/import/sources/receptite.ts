import { load } from 'cheerio';
import { FetchText, RecipeSource, ScrapedRecipe, sitemapLocs, squash } from './types';

const RECIPE_PATH = '/рецепта/';

/**
 * receptite.com ("Веселият Готвач"): schema.org microdata, ingredients as `li[itemprop=ingredients]`
 * with section headers in `.prod_za`, no servings. The category `meta` has an unquoted `content`
 * attribute, so the category is read from the links next to it instead.
 */
export const receptite: RecipeSource = {
  name: 'receptite.com',
  host: 'receptite.com',

  async listUrls(fetchText: FetchText): Promise<string[]> {
    const xml = await fetchText('https://receptite.com/sitemaps/sitemap_recepti.xml');
    if (!xml) return [];
    return sitemapLocs(xml).filter((u) => decodeURIComponent(u).includes(RECIPE_PATH));
  },

  parse(html: string): ScrapedRecipe | null {
    const $ = load(html);
    const scope = $('[itemtype*="schema.org/Recipe"]').first();
    if (!scope.length) return null;
    const title = squash(scope.find('[itemprop="name"]').first().text());
    if (!title) return null;

    const ingredients: string[] = [];
    scope.find('li[itemprop="ingredients"]').each((_, li) => {
      const el = $(li);
      if (el.find('.prod_za').length) return;
      const text = squash(el.text()).replace(/^[•·\s]+/, '');
      if (text) ingredients.push(text);
    });

    const steps: string[] = [];
    scope.find('[itemprop="recipeInstructions"]').each((_, el) => {
      const node = $(el);
      node.find('br').replaceWith('\n');
      for (const para of node.text().split('\n')) {
        const text = squash(para);
        if (text) steps.push(text);
      }
    });

    const categoryLinks = $('meta[itemprop="recipeCategory"]').parent().find('a');
    const category = categoryLinks.length ? squash(categoryLinks.first().text()) : null;

    return { title, category: category || null, cuisine: null, servings: null, ingredients, steps };
  },
};
