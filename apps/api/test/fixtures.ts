import { addDays, todayIso } from '../src/common/dates';

/** Dates relative to the server's today, so tests keep passing on any day. */
export const TODAY = todayIso();
export const day = (offset: number) => addDays(TODAY, offset);

/** A typical onboarding payload used across e2e suites. */
export const onboarding = {
  sex: 'male',
  birthDate: '1995-03-12',
  heightCm: 185,
  weightKg: 113,
  activity: 'light',
  goal: 'lose',
  targetWeightKg: 95,
  healthDataConsent: true,
  today: TODAY,
};
