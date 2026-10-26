/** Fail fast on missing or unsafe configuration. */
export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const env = { ...raw } as Record<string, string | undefined>;

  if (!env.DATABASE_URL) errors.push('DATABASE_URL is required');
  if (!env.JWT_SECRET) errors.push('JWT_SECRET is required');
  else if (env.NODE_ENV === 'production' && (env.JWT_SECRET.length < 32 || env.JWT_SECRET.startsWith('change-me'))) {
    errors.push('JWT_SECRET must be a random string of at least 32 characters in production');
  }

  if (errors.length) throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);

  return {
    ...env,
    API_PORT: env.API_PORT ?? '4000',
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? '7d',
    WEB_URL: env.WEB_URL ?? 'http://localhost:3000',
  };
}
