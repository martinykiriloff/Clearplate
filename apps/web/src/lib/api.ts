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
export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

export interface User {
  id: string;
  email: string;
  name: string | null;
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
  foodId: string | null;
  recipeId: string | null;
  grams: number | null;
  servings: number | null;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
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
  meal: Meal;
  kcal: number;
  proteinG: number;
  reason: string;
}

export interface Today {
  date: string;
  targets: Targets | null;
  eaten: Totals;
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
  brand: string | null;
  barcode: string | null;
  category: string | null;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number | null;
  servingG: number | null;
  servingName: string | null;
  source: "seed" | "user" | "open_food_facts";
  verified: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  mealType: Meal;
  base: string | null;
  ingredients: string;
  method: string;
  servings: number;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
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
