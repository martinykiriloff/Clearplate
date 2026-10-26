import { and, count, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { foods, recipes } from './schema';
import { FOOD_SEED } from './seed-data/foods';
import { FOOD_NAMES_BG, SERVING_NAMES_BG } from './seed-data/foods.bg';
import { RECIPE_SEED } from './seed-data/recipes';
import { RECIPES_BG } from './seed-data/recipes.bg';

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
          return { ...r, servings: 1, nameBg: bg?.name ?? null, ingredientsBg: bg?.ingredients ?? null, methodBg: bg?.method ?? null };
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
