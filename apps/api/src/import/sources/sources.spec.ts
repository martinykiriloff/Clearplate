import { gotvetesmen } from './gotvetesmen';
import { recepti1001 } from './recepti1001';
import { receptite } from './receptite';
import { parseServings, sitemapLocs } from './types';

describe('sitemap helpers', () => {
  it('extracts locations and decodes ampersands', () => {
    expect(sitemapLocs('<urlset><url><loc>https://a.test/x?a=1&amp;b=2</loc></url><url><loc> https://a.test/y </loc></url></urlset>')).toEqual(['https://a.test/x?a=1&b=2', 'https://a.test/y']);
  });

  it('reads servings from free text', () => {
    expect(parseServings('4 servings')).toBe(4);
    expect(parseServings('16 бр')).toBe(16);
    expect(parseServings('')).toBeNull();
    expect(parseServings('999 бр')).toBeNull();
  });
});

describe('receptite.com parser', () => {
  const html = `<div itemscope itemtype="http://schema.org/Recipe"><div class="title_rec_big" itemprop="name">Мусака</div>
    <ul><li itemprop="ingredients">&bull;&nbsp;500 г кайма</li><li itemprop="ingredients"><div class="prod_za">За заливката:</div></li><li itemprop="ingredients">&bull;&nbsp;2 бр. яйца</li></ul>
    <div itemprop="recipeInstructions">Лукът се нарязва.<br />Пече се 30 минути.</div>
    <div><a href="/x">Ястия с кайма</a> &sdot; <a href="/y">Мусака</a><meta itemprop="recipeCategory" content=Ястия с кайма /></div></div>`;

  it('reads title, ingredients without section headers, steps and category', () => {
    expect(receptite.parse(html, '')).toEqual({ title: 'Мусака', category: 'Ястия с кайма', cuisine: null, servings: null, ingredients: ['500 г кайма', '2 бр. яйца'], steps: ['Лукът се нарязва.', 'Пече се 30 минути.'] });
  });

  it('returns null for a page without a recipe', () => {
    expect(receptite.parse('<html><body>Няма рецепта</body></html>', '')).toBeNull();
  });
});

describe('gotvetesmen.com parser', () => {
  const html = `<h1>Кавърма</h1><p itemprop="recipeCategory">Ястия със свинско месо</p><span itemprop="recipeCuisine">Българска</span><span itemprop="recipeYield">4</span>
    <table><tr itemprop="recipeIngredient"><td><svg></svg> свинско месо</td><td>500 г</td></tr><tr itemprop="recipeIngredient"><td>сол</td><td></td></tr></table>
    <div class="uv-box"><h2 class="h3">Приготвяне</h2><div class="uv-box-content"><ol><li>Месото се пържи.</li><li>Добавя се лукът.</li></ol><p>Рецептата Кавърма е предоставена от Мая.</p></div></div>`;

  it('drops nutrition rows, the terms link and amount notes', () => {
    const noisy = `<h1>Суфле</h1><table>
      <tr itemprop="recipeIngredient"><td>яйца</td><td>2</td></tr>
      <tr itemprop="recipeIngredient"><td>сметана</td><td>220 мл, разбита</td></tr>
      <tr itemprop="recipeIngredient"><td>Енергийна 515 kJ</td><td></td></tr>
      <tr itemprop="recipeIngredient"><td>Белтъчини 6 г</td><td></td></tr>
      <tr itemprop="recipeIngredient"><td>Мазнини 9 г</td><td></td></tr>
      <tr itemprop="recipeIngredient"><td><a href="/a/terms">Условия за ползване на ресурсите на портала www.gotvetesmen.com</a></td><td>2</td></tr>
      <tr itemprop="recipeIngredient"><td>1 ч.ч. = 250 мл</td><td></td></tr>
      </table><div itemprop="recipeInstructions">Пече се.</div>`;
    expect(gotvetesmen.parse(noisy, '')?.ingredients).toEqual(['2 яйца', '220 мл сметана']);
  });

  it('joins amount and name and falls back to the method box without microdata', () => {
    expect(gotvetesmen.parse(html, '')).toEqual({ title: 'Кавърма', category: 'Ястия със свинско месо', cuisine: 'Българска', servings: 4, ingredients: ['500 г свинско месо', 'сол'], steps: ['Месото се пържи.', 'Добавя се лукът.'] });
  });
});

describe('1001recepti.com parser', () => {
  it('reads the JSON-LD recipe even with raw line breaks inside strings', () => {
    const html = `<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>
      <script type="application/ld+json">{"@context":"http://schema.org/","@type":"Recipe","name":"Гарнитура","recipeYield":"4 servings","recipeCategory":"Гарнитури",
      "nutrition":{"calories":"32767 calories"},"recipeIngredient":["400 г патладжан","сол"],"recipeInstructions":[{"@type":"HowToStep","text":"Нарязва се.\nПече се."}]}</script>`;
    expect(recepti1001.parse(html, '')).toEqual({ title: 'Гарнитура', category: 'Гарнитури', cuisine: null, servings: 4, ingredients: ['400 г патладжан', 'сол'], steps: ['Нарязва се. Пече се.'] });
  });

  it('falls back to the page markup when the JSON-LD block is missing', () => {
    const html = `<h1>Такоси</h1><nav aria-label="Breadcrumb"><a href="/s/1">Закуски</a><a href="/s/2">Солени</a></nav>
      <select name="servings_combo"><option value="2">2</option><option value="4" SELECTED>4</option></select>
      <ul class="recipe_ingr"><li><span><span>200 г</span> <a href="/s/x">бекон</a></span></li><li><span><span></span> <a href="/s/y">сол</a></span></li></ul>
      <p class="recipe_step">Беконът се пържи.</p>`;
    expect(recepti1001.parse(html, '')).toEqual({ title: 'Такоси', category: 'Закуски', cuisine: null, servings: 4, ingredients: ['200 г бекон', 'сол'], steps: ['Беконът се пържи.'] });
  });

  it('returns null without a Recipe block', () => {
    expect(recepti1001.parse('<script type="application/ld+json">{"@type":"BreadcrumbList"}</script>', '')).toBeNull();
  });
});
