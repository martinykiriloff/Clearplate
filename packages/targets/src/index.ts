/**
 * Clearplate targets engine.
 *
 * Pure functions, no I/O: the API and every client compute the same numbers.
 *
 * - BMR: Mifflin–St Jeor.
 * - TDEE: BMR × activity factor (1.2–1.9).
 * - Calories: TDEE adjusted by goal and pace, never below the safety floor
 *   (1500 kcal for men, 1200 kcal for women).
 * - Protein: g/kg of a *reference* weight, so people with higher body fat
 *   are not given inflated protein targets.
 * - Fat: at least 0.6 g/kg reference weight and about 27% of calories.
 * - Carbs: the remainder.
 */

export type Sex = 'male' | 'female';
export type Goal = 'lose' | 'gain' | 'habits';
export type Pace = 'gentle' | 'standard' | 'fast';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface TargetsInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  pace?: Pace;
  targetWeightKg?: number | null;
}

export type TargetsWarning =
  | 'calorie_floor_applied'
  | 'deficit_capped'
  | 'underweight_no_deficit'
  | 'carbs_at_minimum';

export interface Targets {
  bmr: number;
  tdee: number;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  referenceWeightKg: number;
  /** Expected weekly weight change in kg (negative = loss). An estimate. */
  expectedWeeklyChangeKg: number;
  warnings: TargetsWarning[];
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Deficit as a share of TDEE for each pace. */
export const DEFICIT_BY_PACE: Record<Pace, number> = {
  gentle: 0.1,
  standard: 0.2,
  fast: 0.25,
};

export const SURPLUS_SHARE = 0.1;
export const MAX_DEFICIT_KCAL = 1000;
export const MAX_SURPLUS_KCAL = 500;
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };
export const KCAL_PER_KG_FAT = 7700;
export const MIN_CARBS_G = 50;

export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 350 },
} as const;

export class TargetsInputError extends Error {
  constructor(public readonly field: keyof typeof LIMITS | 'targetWeightKg', message: string) {
    super(message);
    this.name = 'TargetsInputError';
  }
}

export function validateInput(input: TargetsInput): void {
  for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    const value = input[field];
    const { min, max } = LIMITS[field];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new TargetsInputError(field, `${field} must be between ${min} and ${max}`);
    }
  }
  if (input.targetWeightKg != null) {
    const { min, max } = LIMITS.weightKg;
    if (input.targetWeightKg < min || input.targetWeightKg > max) {
      throw new TargetsInputError('targetWeightKg', `targetWeightKg must be between ${min} and ${max}`);
    }
  }
}

export function bmr({ sex, age, heightCm, weightKg }: Pick<TargetsInput, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * Reference weight for protein and fat.
 * Above BMI 25 we use an adjusted weight: the BMI-25 weight plus 40% of the
 * excess. A lower goal weight, if given and higher than that, wins.
 */
export function referenceWeight(weightKg: number, heightCm: number, targetWeightKg?: number | null): number {
  const m = heightCm / 100;
  const bmi25 = 25 * m * m;
  if (weightKg <= bmi25) return weightKg;
  const adjusted = bmi25 + 0.4 * (weightKg - bmi25);
  if (targetWeightKg != null && targetWeightKg < weightKg) {
    return Math.max(adjusted, Math.min(targetWeightKg, weightKg));
  }
  return adjusted;
}

const PROTEIN_G_PER_KG: Record<Goal, number> = { lose: 1.8, gain: 1.8, habits: 1.6 };
const FAT_SHARE = 0.27;
const MIN_FAT_G_PER_KG = 0.6;

const round = (n: number, step = 1) => Math.round(n / step) * step;

export function computeTargets(input: TargetsInput): Targets {
  validateInput(input);
  const warnings: TargetsWarning[] = [];
  const pace = input.pace ?? 'standard';

  const b = bmr(input);
  const tdee = b * ACTIVITY_FACTORS[input.activity];

  let goal = input.goal;
  if (goal === 'lose' && bmi(input.weightKg, input.heightCm) < 18.5) {
    warnings.push('underweight_no_deficit');
    goal = 'habits';
  }

  let calories = tdee;
  if (goal === 'lose') {
    let deficit = tdee * DEFICIT_BY_PACE[pace];
    if (deficit > MAX_DEFICIT_KCAL) {
      deficit = MAX_DEFICIT_KCAL;
      warnings.push('deficit_capped');
    }
    calories = tdee - deficit;
  } else if (goal === 'gain') {
    calories = tdee + Math.min(tdee * SURPLUS_SHARE, MAX_SURPLUS_KCAL);
  }

  const floor = CALORIE_FLOOR[input.sex];
  if (calories < floor) {
    calories = floor;
    warnings.push('calorie_floor_applied');
  }
  // Round to 10 kcal, never towards a deeper deficit than computed.
  calories = goal === 'lose' ? Math.ceil(calories / 10) * 10 : round(calories, 10);

  const refW = referenceWeight(input.weightKg, input.heightCm, input.targetWeightKg);
  const proteinG = round(PROTEIN_G_PER_KG[goal] * refW);
  let fatG = round(Math.max(MIN_FAT_G_PER_KG * refW, (FAT_SHARE * calories) / 9));
  let carbsG = round((calories - proteinG * 4 - fatG * 9) / 4);

  if (carbsG < MIN_CARBS_G) {
    // Trim fat towards its floor before going below the carb minimum.
    const minFat = round(MIN_FAT_G_PER_KG * refW);
    const neededKcal = (MIN_CARBS_G - carbsG) * 4;
    const trim = Math.min(fatG - minFat, Math.ceil(neededKcal / 9));
    fatG -= Math.max(0, trim);
    carbsG = Math.max(0, round((calories - proteinG * 4 - fatG * 9) / 4));
    if (carbsG < MIN_CARBS_G) warnings.push('carbs_at_minimum');
  }

  const expectedWeeklyChangeKg = Math.round((((calories - tdee) * 7) / KCAL_PER_KG_FAT) * 100) / 100;

  return {
    bmr: round(b),
    tdee: round(tdee),
    calories,
    proteinG,
    fatG,
    carbsG,
    referenceWeightKg: Math.round(refW * 10) / 10,
    expectedWeeklyChangeKg,
    warnings,
  };
}

export interface DayTotals {
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** The daily equation: goal − food = left. Negative means over budget. */
export function remaining(targets: Pick<Targets, 'calories' | 'proteinG' | 'fatG' | 'carbsG'>, eaten: DayTotals): DayTotals {
  return {
    calories: round(targets.calories - eaten.calories),
    proteinG: round(targets.proteinG - eaten.proteinG),
    fatG: round(targets.fatG - eaten.fatG),
    carbsG: round(targets.carbsG - eaten.carbsG),
  };
}

/**
 * Exponentially smoothed weight trend (alpha 0.1, as in common trend-weight methods).
 * Input must be sorted by date ascending.
 */
export function weightTrend(points: { date: string; weightKg: number }[], alpha = 0.1): { date: string; weightKg: number; trendKg: number }[] {
  let trend: number | null = null;
  return points.map((p) => {
    trend = trend == null ? p.weightKg : trend + alpha * (p.weightKg - trend);
    return { ...p, trendKg: Math.round(trend * 10) / 10 };
  });
}
