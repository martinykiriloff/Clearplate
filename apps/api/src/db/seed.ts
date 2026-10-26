import { and, count, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { foods, recipes } from './schema';
import { FOOD_SEED } from './seed-data/foods';
import { FOOD_NAMES_BG, SERVING_NAMES_BG } from './seed-data/foods.bg';
import { FOOD_MICROS, Micros } from './seed-data/micros';
import { FOOD_NUTRIENTS, RECIPE_NUTRIENTS } from './seed-data/nutrients';
import { RECIPE_COMPOSITION } from './seed-data/recipe-composition';
import { RECIPE_SEED } from './seed-data/recipes';
import { RECIPES_BG } from './seed-data/recipes.bg';

/** Per-serving micros of a recipe from its composition; keys known for every ingredient only. */
export function recipeMicros(name: string): Micros | null {
  const parts = RECIPE_COMPOSITION[name];
  if (!parts) return null;
  const out: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [food, grams] of parts) {
    const m = FOOD_MICROS[food]?.micros ?? {};
    for (const [k, v] of Object.entries(m)) {
      out[k] = (out[k] ?? 0) + (v * grams) / 100;
      counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  // A nutrient unknown for one ingredient would be understated: leave it out.
  for (const k of Object.keys(out)) {
    if (counts[k] !== parts.length) delete out[k];
    else out[k] = Math.round(out[k] * 1000) / 1000;
  }
  return out;
}

/**
 * Idempotent: inserts the starter catalogue when it is missing, and fills in
 * Bulgarian names on catalogue rows that do not have them yet (databases
 * seeded before translations existed).
 */
export async function seed(databaseUrl: string): Promise<{ foods: number; recipes: number; translated: number }> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool);
  try {
    let insertedFoods = 0;
    let insertedRecipes = 0;
    let translated = 0;

    const [{ value: seedFoods }] = await db.select({ value: count() }).from(foods).where(eq(foods.source, 'seed'));
    if (seedFoods === 0) {
      const rows = FOOD_SEED.map(([name, category, kcal, proteinG, fatG, carbsG, fiberG, servingG, servingName]) => ({
        name,
        nameBg: FOOD_NAMES_BG[name] ?? null,
        category,
        kcal,
        proteinG,
        fatG,
        carbsG,
        fiberG,
        sugarG: FOOD_NUTRIENTS[name]?.[0] ?? null,
        satFatG: FOOD_NUTRIENTS[name]?.[1] ?? null,
        sodiumMg: FOOD_NUTRIENTS[name]?.[2] ?? null,
        micros: FOOD_MICROS[name]?.micros ?? null,
        servingG,
        servingName,
        servingNameBg: servingName ? (SERVING_NAMES_BG[servingName] ?? null) : null,
        source: 'seed' as const,
        verified: false,
      }));
      await db.insert(foods).values(rows);
      insertedFoods = rows.length;
    } else {
      for (const [name, , , , , , , , servingName] of FOOD_SEED) {
        const res = await db
          .update(foods)
          .set({ nameBg: FOOD_NAMES_BG[name] ?? null, servingNameBg: servingName ? (SERVING_NAMES_BG[servingName] ?? null) : null })
          .where(and(eq(foods.source, 'seed'), eq(foods.name, name), isNull(foods.nameBg)))
          .returning({ id: foods.id });
        translated += res.length;
      }
    }

    const [{ value: publicRecipes }] = await db.select({ value: count() }).from(recipes).where(isNull(recipes.ownerId));
    if (publicRecipes === 0) {
      await db.insert(recipes).values(
        RECIPE_SEED.map((r) => {
          const bg = RECIPES_BG[r.name];
          const nut = RECIPE_NUTRIENTS[r.name];
          return {
            ...r,
            servings: 1,
            nameBg: bg?.name ?? null,
            ingredientsBg: bg?.ingredients ?? null,
            methodBg: bg?.method ?? null,
            fiberG: nut?.[0] ?? null,
            sugarG: nut?.[1] ?? null,
            satFatG: nut?.[2] ?? null,
            sodiumMg: nut?.[3] ?? null,
            micros: recipeMicros(r.name),
          };
        }),
      );
      insertedRecipes = RECIPE_SEED.length;
    } else {
      for (const r of RECIPE_SEED) {
        const bg = RECIPES_BG[r.name];
        if (!bg) continue;
        const res = await db
          .update(recipes)
          .set({ nameBg: bg.name, ingredientsBg: bg.ingredients, methodBg: bg.method })
          .where(and(isNull(recipes.ownerId), eq(recipes.name, r.name), isNull(recipes.nameBg)))
          .returning({ id: recipes.id });
        translated += res.length;
      }
    }

    // Secondary nutrients for catalogue rows seeded before they existed.
    for (const [name, [sugarG, satFatG, sodiumMg]] of Object.entries(FOOD_NUTRIENTS)) {
      await db
        .update(foods)
        .set({ sugarG, satFatG, sodiumMg })
        .where(and(eq(foods.source, 'seed'), eq(foods.name, name), isNull(foods.sugarG)));
    }
    for (const [name, [fiberG, sugarG, satFatG, sodiumMg]] of Object.entries(RECIPE_NUTRIENTS)) {
      await db
        .update(recipes)
        .set({ fiberG, sugarG, satFatG, sodiumMg })
        .where(and(isNull(recipes.ownerId), eq(recipes.name, name), isNull(recipes.sugarG)));
    }

    // Vitamins and minerals for rows seeded before they existed.
    for (const [name, { micros }] of Object.entries(FOOD_MICROS)) {
      await db
        .update(foods)
        .set({ micros })
        .where(and(eq(foods.source, 'seed'), eq(foods.name, name), isNull(foods.micros)));
    }
    for (const r of RECIPE_SEED) {
      const micros = recipeMicros(r.name);
      if (!micros) continue;
      await db
        .update(recipes)
        .set({ micros })
        .where(and(isNull(recipes.ownerId), eq(recipes.name, r.name), isNull(recipes.micros)));
    }

    return { foods: insertedFoods, recipes: insertedRecipes, translated };
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
  seed(url)
    .then((r) => console.log(`Seed done: ${r.foods} foods, ${r.recipes} recipes inserted, ${r.translated} rows translated`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
