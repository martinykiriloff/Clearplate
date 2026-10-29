import { load } from 'cheerio';
import { FetchText, parseServings, RecipeSource, ScrapedRecipe, sitemapLocs, squash } from './types';

const SITEMAPS = ['https://www.gotvetesmen.com/sitemap/recipes.xml', 'https://www.gotvetesmen.com/sitemap/userrecipes.xml'];

/**
 * gotvetesmen.com ("Гответе с мен"): schema.org microdata. Ingredients are table rows with the
 * name in the first cell and the amount in the second ("свинско месо" | "500 г"), so the two are
 * joined amount-first for the parser. Servings, category and cuisine are stated.
 */
/**
 * Rows that are not ingredients: a nutrition table pasted into the list ("Мазнини 9 г"), the
 * site's terms-of-use link on broken user recipes, and cup-size notes ("1 ч.ч. = 250 мл").
 */
const NOT_INGREDIENT = /^(?:енергийна|стойност|белтъчини|протеини|мазнини|въглехидрати|калории|захари|фибри|влакнини)\s+[\d.,]+\s*(?:г|g|kcal|kj|ккал|кдж)(?!\p{L})|условия за ползване|=\s*\d+\s*мл/iu;

export const gotvetesmen: RecipeSource = {
  name: 'gotvetesmen.com',
  host: 'www.gotvetesmen.com',

  async listUrls(fetchText: FetchText): Promise<string[]> {
    const urls: string[] = [];
    for (const sitemap of SITEMAPS) {
      const xml = await fetchText(sitemap);
      if (xml) urls.push(...sitemapLocs(xml).filter((u) => u.includes('/recepta/')));
    }
    return [...new Set(urls)];
  },

  parse(html: string): ScrapedRecipe | null {
    const $ = load(html);
    const rows = $('tr[itemprop="recipeIngredient"]');
    if (!rows.length) return null;
    const title = squash($('h1').first().text()) || squash($('title').text().split('|')[0]);
    if (!title) return null;

    const ingredients: string[] = [];
    rows.each((_, tr) => {
      const cells = $(tr).find('td');
      const name = squash(cells.eq(0).text());
      // The amount cell sometimes carries a note after a comma ("220 мл, разбита"); only the amount is kept.
      const amount = squash(cells.eq(1).text()).split(',')[0].trim();
      if (!name || NOT_INGREDIENT.test(name)) return;
      ingredients.push(amount ? `${amount} ${name}` : name);
    });

    const steps: string[] = [];
    $('[itemprop="recipeInstructions"]').each((_, el) => {
      const text = squash($(el).text());
      if (text) steps.push(text);
    });
    if (!steps.length) {
      // Reader-submitted recipes carry no microdata on the method: it is the box headed "Приготвяне".
      $('h2, h3, p.uv-title')
        .filter((_, el) => /^приготвяне/i.test(squash($(el).text())))
        .first()
        .closest('.uv-box')
        .find('.uv-box-content li, .uv-box-content p')
        .each((_, el) => {
          const text = squash($(el).text());
          if (text && !/^рецептата .* е предоставена/i.test(text)) steps.push(text);
        });
    }

    const category = squash($('[itemprop="recipeCategory"]').first().text()) || null;
    const cuisine = squash($('[itemprop="recipeCuisine"]').first().text()) || null;
    const servings = parseServings($('[itemprop="recipeYield"]').first().text());

    return { title, category, cuisine, servings, ingredients, steps };
  },
};
