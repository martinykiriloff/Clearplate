import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const sexEnum = pgEnum('sex', ['male', 'female']);
export const goalEnum = pgEnum('goal', ['lose', 'gain', 'habits']);
export const paceEnum = pgEnum('pace', ['gentle', 'standard', 'fast']);
export const activityEnum = pgEnum('activity_level', ['sedentary', 'light', 'moderate', 'active', 'very_active']);
export const unitSystemEnum = pgEnum('unit_system', ['metric', 'imperial']);
export const mealEnum = pgEnum('meal', ['breakfast', 'lunch', 'dinner', 'snack']);
export const foodSourceEnum = pgEnum('food_source', ['seed', 'user', 'open_food_facts']);
export const moduleEnum = pgEnum('module', ['barcode', 'insights', 'recipes', 'data', 'all']);
export const entitlementSourceEnum = pgEnum('entitlement_source', ['stripe', 'grant']);
export const entitlementStatusEnum = pgEnum('entitlement_status', ['active', 'past_due', 'canceled']);
export const localeEnum = pgEnum('locale', ['en', 'bg']);
export const targetSourceEnum = pgEnum('target_source', ['questionnaire', 'manual', 'adaptive']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  /** Incremented to revoke every issued token (logout everywhere, account takeover defence). */
  tokenVersion: integer('token_version').notNull().default(0),
  /** UI language; also used for anything the server writes in the user's language. */
  locale: localeEnum('locale').notNull().default('en'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  ...timestamps,
});

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('oauth_provider_account_uq').on(t.provider, t.providerAccountId), index('oauth_user_idx').on(t.userId)],
);

/** Questionnaire answers. Health data: requires explicit consent (GDPR Art. 9). */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  sex: sexEnum('sex').notNull(),
  birthDate: date('birth_date').notNull(),
  heightCm: real('height_cm').notNull(),
  activity: activityEnum('activity').notNull(),
  goal: goalEnum('goal').notNull(),
  pace: paceEnum('pace').notNull().default('standard'),
  targetWeightKg: real('target_weight_kg'),
  unitSystem: unitSystemEnum('unit_system').notNull().default('metric'),
  healthDataConsentAt: timestamp('health_data_consent_at', { withTimezone: true }).notNull(),
  marketingConsent: boolean('marketing_consent').notNull().default(false),
  ...timestamps,
});

/** Every change of targets is a new row; the latest effective_from <= date applies. */
export const targetSets = pgTable(
  'target_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    effectiveFrom: date('effective_from').notNull(),
    source: targetSourceEnum('source').notNull(),
    calories: integer('calories').notNull(),
    proteinG: integer('protein_g').notNull(),
    fatG: integer('fat_g').notNull(),
    carbsG: integer('carbs_g').notNull(),
    bmr: integer('bmr').notNull(),
    tdee: integer('tdee').notNull(),
    warnings: text('warnings').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('target_sets_user_date_idx').on(t.userId, t.effectiveFrom)],
);

/** Nutrition values are per 100 g (or 100 ml). */
export const foods = pgTable(
  'foods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Bulgarian name; null = same as `name` (e.g. a brand name). */
    nameBg: text('name_bg'),
    brand: text('brand'),
    barcode: text('barcode'),
    category: text('category'),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    fatG: real('fat_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    satFatG: real('sat_fat_g'),
    sodiumMg: real('sodium_mg'),
    /** Vitamins, minerals and fat quality per 100 g (see seed-data/micros.ts for keys and units). */
    micros: jsonb('micros').$type<Record<string, number>>(),
    servingG: real('serving_g'),
    servingName: text('serving_name'),
    servingNameBg: text('serving_name_bg'),
    source: foodSourceEnum('source').notNull().default('seed'),
    verified: boolean('verified').notNull().default(false),
    /** Owner of a private custom food; null = catalogue. Deleted with the user (GDPR). */
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('foods_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('foods_name_bg_trgm_idx').using('gin', sql`${t.nameBg} gin_trgm_ops`),
    // A barcode is unique in the catalogue and per user, never across users.
    uniqueIndex('foods_catalogue_barcode_uq').on(t.barcode).where(sql`${t.createdById} is null and ${t.barcode} is not null`),
    uniqueIndex('foods_user_barcode_uq').on(t.createdById, t.barcode).where(sql`${t.createdById} is not null and ${t.barcode} is not null`),
  ],
);

export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    nameBg: text('name_bg'),
    mealType: mealEnum('meal_type').notNull(),
    base: text('base'),
    ingredients: text('ingredients').notNull(),
    ingredientsBg: text('ingredients_bg'),
    method: text('method').notNull(),
    methodBg: text('method_bg'),
    servings: integer('servings').notNull().default(1),
    /** Per serving */
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    fatG: real('fat_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    satFatG: real('sat_fat_g'),
    sodiumMg: real('sodium_mg'),
    /** Per serving. */
    micros: jsonb('micros').$type<Record<string, number>>(),
    /** Cuisine as the source states it (e.g. "Българска"); null = unknown. */
    cuisine: text('cuisine'),
    /** Host the recipe was imported from (e.g. "receptite.com"); null = authored here. */
    sourceName: text('source_name'),
    /** Canonical page of an imported recipe; the attribution link and the idempotency key of re-imports. */
    sourceUrl: text('source_url'),
    /**
     * Share (0..1) of the ingredient mass that was matched to the food catalogue when the
     * macros were estimated from the ingredient list. null = macros were authored, not estimated.
     */
    estimateCoverage: real('estimate_coverage'),
    /** null = public catalogue recipe */
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    index('recipes_meal_idx').on(t.mealType),
    index('recipes_owner_idx').on(t.ownerId),
    index('recipes_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
    index('recipes_name_bg_trgm_idx').using('gin', sql`${t.nameBg} gin_trgm_ops`),
    uniqueIndex('recipes_source_url_uq').on(t.sourceUrl).where(sql`${t.sourceUrl} is not null`),
  ],
);

/** Values are a snapshot at logging time, so later food edits never rewrite history. */
export const diaryEntries = pgTable(
  'diary_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    meal: mealEnum('meal').notNull(),
    foodId: uuid('food_id').references(() => foods.id, { onDelete: 'set null' }),
    recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
    label: text('label').notNull(),
    /** Bulgarian label snapshot when the source food/recipe has one. */
    labelBg: text('label_bg'),
    grams: real('grams'),
    servings: real('servings'),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    fatG: real('fat_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    /** Secondary nutrients; null when the source has no data for them. */
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    satFatG: real('sat_fat_g'),
    sodiumMg: real('sodium_mg'),
    micros: jsonb('micros').$type<Record<string, number>>(),
    isEstimate: boolean('is_estimate').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Soft delete enables undo */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('diary_user_date_idx').on(t.userId, t.date)],
);

export const weightEntries = pgTable(
  'weight_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('weight_user_date_uq').on(t.userId, t.date)],
);

/**
 * Paid modules a user can use. Stripe subscriptions and manual grants (e.g.
 * paid outside the app) are rows here; access = any active row for the module
 * or for 'all' whose period has not ended.
 */
export const entitlements = pgTable(
  'entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    module: moduleEnum('module').notNull(),
    source: entitlementSourceEnum('source').notNull(),
    status: entitlementStatusEnum('status').notNull().default('active'),
    /** null = no end (grants); otherwise access ends after this moment. */
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    stripeSubscriptionId: text('stripe_subscription_id'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('entitlements_user_idx').on(t.userId),
    uniqueIndex('entitlements_subscription_module_uq').on(t.stripeSubscriptionId, t.module).where(sql`${t.stripeSubscriptionId} is not null`),
    uniqueIndex('entitlements_grant_uq').on(t.userId, t.module).where(sql`${t.source} = 'grant'`),
  ],
);

/**
 * One row per camera scan a user made on a given local day. Free users get
 * FREE_SCANS_PER_DAY distinct products per day; the Barcode module lifts the
 * limit. Re-scanning the same product on the same day never costs a scan.
 */
export const barcodeScans = pgTable(
  'barcode_scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The user's local date the scan counts against. */
    date: date('date').notNull(),
    code: text('code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('barcode_scans_user_date_code_uq').on(t.userId, t.date, t.code)],
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type TargetSet = typeof targetSets.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type WeightEntry = typeof weightEntries.$inferSelect;
export type MealType = (typeof mealEnum.enumValues)[number];
export type Locale = (typeof localeEnum.enumValues)[number];
export type PaidModule = (typeof moduleEnum.enumValues)[number];
export type Entitlement = typeof entitlements.$inferSelect;
export type BarcodeScan = typeof barcodeScans.$inferSelect;
