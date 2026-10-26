import { drizzle } from 'drizzle-orm/node-postgres';
import { count, eq, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import { foods, recipes } from './schema';
import { FOOD_SEED } from './seed-data/foods';
import { RECIPE_SEED } from './seed-data/recipes';

/** Idempotent: inserts the starter catalogue only when it is not there yet. */
export async function seed(databaseUrl: string): Promise<{ foods: number; recipes: number }> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const db = drizzle(pool);
  try {
    let insertedFoods = 0;
    let insertedRecipes = 0;

    const [{ value: seedFoods }] = await db.select({ value: count() }).from(foods).where(eq(foods.source, 'seed'));
    if (seedFoods === 0) {
      const rows = FOOD_SEED.map(([name, category, kcal, proteinG, fatG, carbsG, fiberG, servingG, servingName]) => ({
        name,
        category,
        kcal,
        proteinG,
        fatG,
        carbsG,
        fiberG,
        servingG,
        servingName,
        source: 'seed' as const,
        verified: false,
      }));
      await db.insert(foods).values(rows);
      insertedFoods = rows.length;
    }

    const [{ value: publicRecipes }] = await db.select({ value: count() }).from(recipes).where(isNull(recipes.ownerId));
    if (publicRecipes === 0) {
      await db.insert(recipes).values(RECIPE_SEED.map((r) => ({ ...r, servings: 1 })));
      insertedRecipes = RECIPE_SEED.length;
    }

    return { foods: insertedFoods, recipes: insertedRecipes };
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
    .then((r) => console.log(`Seed done: ${r.foods} foods, ${r.recipes} recipes inserted`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
