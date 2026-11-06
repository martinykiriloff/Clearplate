import type { IngredientEntry } from './ingredient-dictionary';
import { matchParsed } from './ingredient-matcher';
import { ParsedIngredient, parseIngredientLine, Unit } from './ingredient-parser';

/** Catalogue values per 100 g. Secondary nutrients may be unknown (null). */
export interface FoodMacros {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
}

export interface Macros {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
}

export type IngredientResolution =
  | { kind: 'matched'; parsed: ParsedIngredient; food: string; grams: number }
  | { kind: 'no_food'; parsed: ParsedIngredient; grams: number | null }
  | { kind: 'no_amount'; parsed: ParsedIngredient; food: string }
  | { kind: 'heading'; parsed: ParsedIngredient };

export interface RecipeEstimate {
  /** Whole recipe, before dividing by servings. */
  total: Macros;
  /** Grams of ingredients that were matched to a catalogue food. */
  matchedG: number;
  /** Grams of every ingredient whose amount could be read, matched or not. */
  knownG: number;
  /**
   * The smaller of two shares: matched grams over all weighable grams, and matched lines over all
   * ingredient lines. An unmatched ingredient without a weight still lowers it. 0 when nothing matched.
   */
  coverage: number;
  ingredients: IngredientResolution[];
}

const ML_PER_UNIT: Partial<Record<Unit, number>> = { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250, teacup: 200, coffeecup: 100, glass: 250 };

/** Rough weights for countable units when the dictionary has none for the food. Coarse, but better than dropping the line. */
const GENERIC_UNIT_G: Partial<Record<Unit, number>> = { bunch: 50, can: 400, pack: 250, tub: 400, slice: 30, stalk: 20, leaf: 1, cube: 10, grain: 0.1 };

/** Oil "for frying" is mostly left in the pan; what the food absorbs is roughly this much. A litre of oil in a recipe means deep frying. */
const FRYING_OIL_MAX_G = 40;
const BARE_NUMBER_IS_GRAMS_FROM = 25;
const DEEP_FRY_OIL_G = 300;
const FRYING = /за пържене|за фритюр|за запържване|за дълбоко пържене|в която ще пържим|за намазване на тавата|за намазване|за тавата|за формата/i;
const OILS = new Set(['Sunflower oil', 'Olive oil, extra virgin', 'Lard', 'Coconut oil', 'Butter', 'Margarine']);
/** "Flour for dusting", "sugar for sprinkling": a token amount, whatever the dictionary default says. */
const DUSTING = /за поръсване|за овалване|за панировка|за посипване|за украса|за декорация|за оваляне|за разточване|за поръсване отгоре/i;
const DUSTING_MAX_G = 20;

/** Weight of one ingredient in grams, or null when the measure cannot be converted for this food. */
export function gramsOf(parsed: ParsedIngredient, entry: IngredientEntry | null): number | null {
  const { quantity, unit } = parsed;
  if (quantity == null) return entry?.defaultG ?? null;
  if (unit === 'g') return quantity;
  if (unit === 'kg') return quantity * 1000;
  const ml = unit ? ML_PER_UNIT[unit] : undefined;
  if (ml != null) return quantity * ml * (entry?.gPerMl ?? 1);
  if (unit === 'pinch') return quantity * (entry?.unitG?.pinch ?? 0.4);
  // "500 телешко бонфиле": a bare number this large is grams with the unit left out, not a count.
  if (unit == null && quantity >= BARE_NUMBER_IS_GRAMS_FROM) return quantity;
  const countable: Unit = unit ?? 'piece';
  const perUnit = entry?.unitG?.[countable] ?? (countable === 'head' ? entry?.unitG?.piece : undefined) ?? GENERIC_UNIT_G[countable];
  return perUnit != null ? quantity * perUnit : null;
}

const scale = (per100: number | null, grams: number): number | null => (per100 == null ? null : (per100 * grams) / 100);

const addNullable = (a: number | null, b: number | null): number | null => (a == null || b == null ? null : a + b);

/**
 * Estimates the nutrition of a recipe from its ingredient lines and a catalogue lookup.
 * Unknown secondary nutrients (fibre, sugar, saturated fat, sodium) make the total unknown,
 * so a recipe never shows an understated value.
 */
export function estimateRecipe(lines: string[], catalogue: ReadonlyMap<string, FoodMacros>): RecipeEstimate {
  const total: Macros = { kcal: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, sugarG: 0, satFatG: 0, sodiumMg: 0 };
  let matchedG = 0;
  let knownG = 0;
  const ingredients: IngredientResolution[] = [];

  for (const line of lines) {
    const parsed = parseIngredientLine(line);
    if (parsed.isHeading) {
      ingredients.push({ kind: 'heading', parsed });
      continue;
    }
    const entry = matchParsed(parsed);
    const food = entry ? catalogue.get(entry.food) : undefined;
    let grams = gramsOf(parsed, entry);
    if (entry && grams != null && OILS.has(entry.food) && (FRYING.test(parsed.raw) || grams > DEEP_FRY_OIL_G)) grams = Math.min(grams, FRYING_OIL_MAX_G);
    if (grams != null && DUSTING.test(parsed.raw)) grams = Math.min(grams, DUSTING_MAX_G);
    if (!entry || !food) {
      // Only an explicit mass can be weighed without knowing the food.
      const known = parsed.unit === 'g' || parsed.unit === 'kg' || parsed.unit === 'ml' || parsed.unit === 'l' ? gramsOf(parsed, null) : null;
      if (known != null) knownG += known;
      ingredients.push({ kind: 'no_food', parsed, grams: known });
      continue;
    }
    if (grams == null) {
      ingredients.push({ kind: 'no_amount', parsed, food: entry.food });
      continue;
    }
    matchedG += grams;
    knownG += grams;
    total.kcal += (food.kcal * grams) / 100;
    total.proteinG += (food.proteinG * grams) / 100;
    total.fatG += (food.fatG * grams) / 100;
    total.carbsG += (food.carbsG * grams) / 100;
    total.fiberG = addNullable(total.fiberG, scale(food.fiberG, grams));
    total.sugarG = addNullable(total.sugarG, scale(food.sugarG, grams));
    total.satFatG = addNullable(total.satFatG, scale(food.satFatG, grams));
    total.sodiumMg = addNullable(total.sodiumMg, scale(food.sodiumMg, grams));
    ingredients.push({ kind: 'matched', parsed, food: entry.food, grams });
  }

  const lines_ = ingredients.filter((i) => i.kind !== 'heading');
  const matchedLines = lines_.filter((i) => i.kind === 'matched' || i.kind === 'no_amount').length;
  const massCoverage = knownG > 0 ? matchedG / knownG : 0;
  const lineCoverage = lines_.length ? matchedLines / lines_.length : 0;
  return { total, matchedG, knownG, coverage: Math.min(massCoverage, lineCoverage), ingredients };
}

/** Rounds a per-serving value the way the catalogue stores it (whole kcal, grams to one decimal). */
export const perServing = (total: Macros, servings: number): Macros => {
  const div = (v: number | null, d = 10): number | null => (v == null ? null : Math.round((v / servings) * d) / d);
  return {
    kcal: Math.round(total.kcal / servings),
    proteinG: div(total.proteinG) ?? 0,
    fatG: div(total.fatG) ?? 0,
    carbsG: div(total.carbsG) ?? 0,
    fiberG: div(total.fiberG),
    sugarG: div(total.sugarG),
    satFatG: div(total.satFatG),
    sodiumMg: div(total.sodiumMg, 1),
  };
};

/**
 * Servings when the source gives none: the raw weight divided by a typical plate for the
 * kind of dish. Baked goods and desserts come in small pieces, mains in ~400 g plates.
 */
export function estimateServings(totalG: number, portionG: number): number {
  if (totalG <= 0) return 1;
  return Math.min(24, Math.max(1, Math.round(totalG / portionG)));
}
