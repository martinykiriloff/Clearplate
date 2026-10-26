import { BadRequestException } from '@nestjs/common';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Server fallback for "today". Clients should send their local date. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Accepts an optional YYYY-MM-DD query value, defaulting to today. */
export function parseDateParam(value: string | undefined): string {
  if (value == null || value === '') return todayIso();
  if (!isIsoDate(value)) throw new BadRequestException('date must be YYYY-MM-DD');
  return value;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole years between a birth date and a reference date. */
export function ageOn(birthDate: string, on: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * A client-supplied "today" (the user's local date) may differ from the server's
 * UTC date by at most one day across time zones. Anything further is rejected
 * so it cannot be used to bypass date-based rules such as the age gate.
 */
export function clientToday(value: string | undefined): string {
  const server = todayIso();
  if (value == null) return server;
  if (!isIsoDate(value) || value < addDays(server, -1) || value > addDays(server, 1)) {
    throw new BadRequestException('today must be your current local date (YYYY-MM-DD)');
  }
  return value;
}
