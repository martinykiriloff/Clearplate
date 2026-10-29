import { FOOD_SEED } from '../db/seed-data/foods';
import { COOKING_FOOD_SEED } from '../db/seed-data/foods.cooking';
import { INGREDIENT_DICTIONARY } from './ingredient-dictionary';
import { matchIngredient, matchParsed } from './ingredient-matcher';
import { parseIngredientLine } from './ingredient-parser';
import { estimateRecipe, estimateServings, FoodMacros, gramsOf, perServing } from './recipe-nutrition';

const catalogue = new Map<string, FoodMacros>(
  [...FOOD_SEED, ...COOKING_FOOD_SEED].map(([name, , kcal, proteinG, fatG, carbsG, fiberG]) => [name, { kcal, proteinG, fatG, carbsG, fiberG, sugarG: null, satFatG: null, sodiumMg: null }]),
);

describe('ingredient dictionary', () => {
  it('only points at foods that exist in the seed catalogue', () => {
    const missing = INGREDIENT_DICTIONARY.map((e) => e.food).filter((f) => !catalogue.has(f));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('prefers the most specific stem', () => {
    expect(matchIngredient('домати')?.food).toBe('Tomato');
    expect(matchIngredient('доматено пюре')?.food).toBe('Tomato paste');
    expect(matchIngredient('кисело мляко')?.food).toBe('Yogurt, plain whole milk 3.6%');
    expect(matchIngredient('прясно мляко')?.food).toBe('Milk, whole 3.5%');
    expect(matchIngredient('черен пипер')?.food).toBe('Black pepper, ground');
    expect(matchIngredient('червен пипер')?.food).toBe('Paprika, sweet');
    expect(matchIngredient('чушки')?.food).toBe('Bell pepper, red');
    expect(matchIngredient('телешка кайма')?.food).toBe('Ground beef 10% fat, raw');
    expect(matchIngredient('кайма')?.food).toBe('Ground pork and beef mix, raw');
    expect(matchIngredient('сирене грюер')?.food).toBe('Yellow cheese (kashkaval)');
    expect(matchIngredient('нещо непознато')).toBeNull();
  });

  it('falls back to the alternative readings of a line', () => {
    expect(matchParsed(parseIngredientLine('черен или бял пипер'))?.food).toBe('Black pepper, ground');
    expect(matchParsed(parseIngredientLine('1 ч.ч. кисело или прясно мляко'))?.food).toBe('Yogurt, plain whole milk 3.6%');
    expect(matchParsed(parseIngredientLine('80 г печени, солени фъстъци'))?.food).toBe('Peanuts');
    expect(matchParsed(parseIngredientLine('2 с.л. гий или масло'))?.food).toBe('Butter');
    expect(matchParsed(parseIngredientLine('500 г варено или печено телешко месо'))?.food).toBe('Beef, stewing, raw');
  });
});

describe('gramsOf', () => {
  const grams = (line: string) => {
    const parsed = parseIngredientLine(line);
    return gramsOf(parsed, matchIngredient(parsed.name));
  };

  it('converts mass, volume with density, and household units', () => {
    expect(grams('500 г кайма')).toBe(500);
    expect(grams('1 кг картофи')).toBe(1000);
    expect(grams('100 мл олио')).toBeCloseTo(92);
    expect(grams('2 с.л. брашно')).toBeCloseTo(15.9);
    expect(grams('3 яйца')).toBe(150);
    expect(grams('2 скилидки чесън')).toBe(6);
    expect(grams('1 глава лук')).toBe(110);
    expect(grams('сол')).toBe(5);
  });

  it('treats a large bare number as grams', () => {
    expect(grams('500 телешко бонфиле')).toBe(500);
    expect(grams('2 пилешки пържоли')).toBe(300);
  });

  it('returns null when nothing is known about the amount', () => {
    expect(grams('кайма')).toBeNull();
  });
});

describe('estimateRecipe', () => {
  it('sums matched ingredients and reports coverage honestly', () => {
    const e = estimateRecipe(['200 г кайма', '100 г ориз', 'За соса:', '100 г непознато нещо', 'сол'], catalogue);
    expect(e.matchedG).toBe(305);
    expect(e.knownG).toBe(405);
    // 3 of 4 ingredient lines matched, 305 of 405 g: the lower share is reported.
    expect(e.coverage).toBeCloseTo(0.75);
    expect(e.total.kcal).toBeCloseTo(200 * 2.5 + 100 * 3.65);
    expect(e.ingredients.map((i) => i.kind)).toEqual(['matched', 'matched', 'heading', 'no_food', 'matched']);
  });

  it('caps oil for frying and flour for dusting', () => {
    const e = estimateRecipe(['1 л олио за пържене', 'брашно за овалване'], catalogue);
    const grams = e.ingredients.map((i) => (i.kind === 'matched' ? Math.round(i.grams) : null));
    expect(grams).toEqual([40, 20]);
  });

  it('leaves a secondary nutrient unknown when any ingredient lacks it', () => {
    const partial = new Map(catalogue);
    partial.set('Salt', { ...catalogue.get('Salt')!, fiberG: null });
    expect(estimateRecipe(['100 г ориз', 'сол'], partial).total.fiberG).toBeNull();
    expect(estimateRecipe(['100 г ориз'], partial).total.fiberG).toBeCloseTo(1.3);
  });
});

describe('perServing and estimateServings', () => {
  it('divides and rounds like the catalogue stores values', () => {
    const total = { kcal: 1001, proteinG: 33.33, fatG: 10, carbsG: 0, fiberG: null, sugarG: 3, satFatG: null, sodiumMg: 1234 };
    expect(perServing(total, 3)).toEqual({ kcal: 334, proteinG: 11.1, fatG: 3.3, carbsG: 0, fiberG: null, sugarG: 1, satFatG: null, sodiumMg: 411 });
  });

  it('estimates servings from the raw weight within sane bounds', () => {
    expect(estimateServings(1600, 400)).toBe(4);
    expect(estimateServings(100, 400)).toBe(1);
    expect(estimateServings(50000, 400)).toBe(24);
  });
});
