import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'cp_session';

/** Parses "7d", "12h", "30m", "3600s" or plain seconds into milliseconds. */
export function durationMs(value: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid duration: ${value}`);
  const n = Number(m[1]);
  const unit = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as '' | 's' | 'm' | 'h' | 'd'];
  return n * unit * 1000;
}

export function sessionCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function setSessionCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(maxAgeMs));
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(0), maxAge: undefined });
}
