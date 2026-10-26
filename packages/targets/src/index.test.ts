import { describe, expect, it } from 'vitest';
import { bmr, computeTargets, referenceWeight, remaining, TargetsInputError, weightTrend } from './index';

describe('bmr (Mifflin–St Jeor)', () => {
  it('matches the published formula for men and women', () => {
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    expect(bmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25);
  });
});

describe('referenceWeight', () => {
  it('returns actual weight at or below BMI 25', () => {
    expect(referenceWeight(70, 180)).toBe(70);
  });
  it('adjusts weight above BMI 25', () => {
    // BMI-25 weight at 185 cm = 85.5625; + 0.4 × (113 − 85.5625)
    expect(referenceWeight(113, 185)).toBeCloseTo(96.5375);
  });
});

describe('computeTargets', () => {
  const martinLike = {
    sex: 'male' as const,
    age: 31,
    heightCm: 185,
    weightKg: 113,
    activity: 'light' as const,
    goal: 'lose' as const,
  };

  it('builds a deficit with macros that add up to the calories', () => {
    const t = computeTargets(martinLike);
    expect(t.calories).toBeLessThan(t.tdee);
    const kcalFromMacros = t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4;
    expect(Math.abs(kcalFromMacros - t.calories)).toBeLessThanOrEqual(10);
    expect(t.proteinG).toBe(174);
    expect(t.expectedWeeklyChangeKg).toBeLessThan(0);
    expect(t.warnings).toEqual([]);
  });

  it('caps the deficit at 1000 kcal', () => {
    const t = computeTargets({ ...martinLike, activity: 'very_active', pace: 'fast', weightKg: 180 });
    expect(t.tdee - t.calories).toBeLessThanOrEqual(1000);
    expect(t.warnings).toContain('deficit_capped');
  });

  it('never goes below the calorie floor', () => {
    const t = computeTargets({ sex: 'female', age: 40, heightCm: 160, weightKg: 60, activity: 'sedentary', goal: 'lose', pace: 'fast' });
    expect(t.calories).toBe(1200);
    expect(t.warnings).toContain('calorie_floor_applied');
  });

  it('holds maintenance instead of a surplus when maintenance is below the floor', () => {
    const t = computeTargets({ sex: 'female', age: 75, heightCm: 150, weightKg: 52, activity: 'sedentary', goal: 'lose' });
    expect(t.tdee).toBeLessThan(1200);
    expect(t.calories).toBeLessThanOrEqual(t.tdee);
    expect(t.expectedWeeklyChangeKg).toBeLessThanOrEqual(0);
    expect(t.warnings).toContain('maintenance_below_floor');
  });

  it('refuses a deficit for underweight users', () => {
    const t = computeTargets({ sex: 'female', age: 25, heightCm: 170, weightKg: 50, activity: 'moderate', goal: 'lose' });
    expect(t.warnings).toContain('underweight_no_deficit');
    expect(t.calories).toBeGreaterThanOrEqual(t.tdee - 10);
  });

  it('adds a capped surplus for gain', () => {
    const t = computeTargets({ ...martinLike, weightKg: 70, goal: 'gain' });
    expect(t.calories - t.tdee).toBeGreaterThan(0);
    expect(t.calories - t.tdee).toBeLessThanOrEqual(505);
  });

  it('rejects under-18 users and out-of-range inputs', () => {
    expect(() => computeTargets({ ...martinLike, age: 16 })).toThrow(TargetsInputError);
    expect(() => computeTargets({ ...martinLike, heightCm: 300 })).toThrow(TargetsInputError);
  });
});

describe('remaining', () => {
  it('is goal minus food', () => {
    expect(remaining({ calories: 2050, proteinG: 180, fatG: 65, carbsG: 190 }, { calories: 1190, proteinG: 112, fatG: 38, carbsG: 96 })).toEqual({
      calories: 860,
      proteinG: 68,
      fatG: 27,
      carbsG: 94,
    });
  });
});

describe('weightTrend', () => {
  it('smooths noisy weigh-ins', () => {
    const t = weightTrend([
      { date: '2026-10-01', weightKg: 113 },
      { date: '2026-10-02', weightKg: 114 },
      { date: '2026-10-03', weightKg: 112 },
    ]);
    expect(t[0].trendKg).toBe(113);
    expect(t[1].trendKg).toBe(113.1);
    expect(t[2].trendKg).toBe(113);
  });
});

import { macroSplit, nutrientGoals } from './index';

describe('nutrientGoals', () => {
  it('scales fiber and saturated fat with calories', () => {
    expect(nutrientGoals(2000)).toEqual({ fiberMinG: 28, satFatMaxG: 22, sodiumMaxMg: 2300 });
  });
});

describe('macroSplit', () => {
  it('returns calorie shares that always sum to 100', () => {
    const s = macroSplit({ proteinG: 174, fatG: 71, carbsG: 254 });
    expect(s.protein + s.fat + s.carbs).toBe(100);
    expect(s.protein).toBe(30);
  });
  it('is zero for an empty day', () => {
    expect(macroSplit({ proteinG: 0, fatG: 0, carbsG: 0 })).toEqual({ protein: 0, fat: 0, carbs: 0 });
  });
});

import { microTargets } from './index';

describe('microTargets', () => {
  it('follows the DRI tables by sex and age', () => {
    const man = microTargets('male', 31);
    expect(man.vitaminC).toEqual({ amount: 90, kind: 'RDA' });
    expect(man.magnesium.amount).toBe(420);
    expect(man.iron.amount).toBe(8);
    const woman = microTargets('female', 30);
    expect(woman.iron.amount).toBe(18);
    expect(microTargets('female', 55).iron.amount).toBe(8);
    expect(microTargets('male', 75).vitaminD.amount).toBe(20);
  });
});
