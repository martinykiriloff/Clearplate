/**
 * Thin client for the Clearplate API. Requests go to the same origin (/api is
 * proxied to NestJS), so the httpOnly session cookie travels automatically.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = body?.message;
    const message = Array.isArray(raw) ? raw.join(". ") : typeof raw === "string" ? raw : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

/** SWR fetcher */
export const fetcher = <T,>(path: string) => api<T>(path);

// ---- Response types (mirror apps/api) ----

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export interface User {
  id: string;
  email: string;
  name: string | null;
  locale: "en" | "bg";
  onboarded: boolean;
}

export interface Totals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface Targets extends Totals {
  bmr: number;
  tdee: number;
  source: "questionnaire" | "manual" | "adaptive";
  effectiveFrom: string;
  warnings: string[];
}

export interface DiaryEntry {
  id: string;
  date: string;
  meal: Meal;
  label: string;
  labelBg: string | null;
  foodId: string | null;
  recipeId: string | null;
  grams: number | null;
  servings: number | null;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  micros: Record<string, number> | null;
  isEstimate: boolean;
}

export interface MealGroup {
  meal: Meal;
  totals: Totals;
  entries: DiaryEntry[];
}

export interface WeightSummary {
  date: string;
  weightKg: number;
  trendKg: number;
  change7dKg: number | null;
}

export interface NextBestFood {
  recipeId: string;
  name: string;
  nameBg: string | null;
  meal: Meal;
  kcal: number;
  proteinG: number;
  reason: { kind: "protein_gap"; coveredG: number; gapG: number } | { kind: "fits_budget"; leftKcal: number };
}

export interface NutrientTotals {
  fiberG: number;
  sugarG: number;
  satFatG: number;
  sodiumMg: number;
  coveragePct: number;
  micros: Record<string, number>;
  microCoveragePct: number;
}

export interface MicroTarget {
  amount: number;
  kind: "RDA" | "AI";
}

export interface NutrientGoals {
  fiberMinG: number;
  satFatMaxG: number;
  sodiumMaxMg: number;
}

export interface MacroSplit {
  protein: number;
  fat: number;
  carbs: number;
}

export type PaidModule = "barcode" | "insights" | "recipes" | "data";

export interface Billing {
  modules: Record<PaidModule, boolean>;
  entitlements: { module: PaidModule | "all"; source: "stripe" | "grant"; status: string; currentPeriodEnd: string | null }[];
  payments: boolean;
  plans: { plan: "barcode" | "all"; module: string; intervals: ("month" | "year")[] }[];
  /** Barcode lookups a free account gets per day. */
  freeScansPerDay: number;
}

/** Camera scans left today. `limit`/`remaining` are null with the Barcode module (unlimited). */
export interface ScanQuota {
  limit: number | null;
  used: number;
  remaining: number | null;
  date: string;
}

export interface Today {
  date: string;
  targets: Targets | null;
  eaten: Totals;
  nutrients: NutrientTotals;
  nutrientGoals: NutrientGoals | null;
  microTargets: Record<string, MicroTarget> | null;
  split: { eaten: MacroSplit; target: MacroSplit | null };
  remaining: Totals | null;
  progress: number | null;
  meals: MealGroup[];
  nextBestFood: NextBestFood | null;
  weight: WeightSummary | null;
  streak: number;
}

export interface Food {
  id: string;
  name: string;
  nameBg: string | null;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
  micros: Record<string, number> | null;
  servingG: number | null;
  servingName: string | null;
  servingNameBg: string | null;
  source: "seed" | "user" | "open_food_facts";
  verified: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  nameBg: string | null;
  mealType: Meal;
  base: string | null;
  ingredients: string;
  ingredientsBg: string | null;
  method: string;
  methodBg: string | null;
  servings: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** Cuisine as the source states it; null = unknown. */
  cuisine: string | null;
  /** Host an imported recipe came from (e.g. "receptite.com"); null = authored in Clearplate. */
  sourceName: string | null;
  sourceUrl: string | null;
  /** 0..1 share of the ingredients matched to the catalogue when the macros were estimated; null = authored macros. */
  estimateCoverage: number | null;
  ownerId: string | null;
}

export interface Profile {
  sex: "male" | "female";
  birthDate: string;
  heightCm: number;
  activity: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "lose" | "gain" | "habits";
  pace: "gentle" | "standard" | "fast";
  targetWeightKg: number | null;
  unitSystem: "metric" | "imperial";
  marketingConsent: boolean;
  healthDataConsentAt: string;
}

export interface WeightRange {
  from: string;
  to: string;
  points: { date: string; weightKg: number; trendKg: number }[];
  summary: WeightSummary | null;
}
