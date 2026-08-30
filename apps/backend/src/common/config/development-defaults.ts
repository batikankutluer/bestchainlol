/* eslint-disable no-console */

/**
 * Values the stack falls back to when a variable is missing **outside
 * production**. They exist so that a fresh clone runs:
 *
 *     docker compose up -d --build
 *     bun run dev
 *
 * without anyone having to set up a secret manager first. Doppler is what you
 * adopt when the stack leaves your laptop — it should not be the thing standing
 * between you and the first green health check.
 *
 * These are matched by the same defaults in docker-compose.yml, so the backend
 * and the database it connects to agree without either being configured.
 *
 * In production none of this applies: a missing variable is fatal, by design.
 */
const DEVELOPMENT_DEFAULTS: Record<string, string> = {
  DATABASE_URL: 'postgresql://app:app@localhost:55432/app?schema=public',
  // Obviously fake on sight. Fixed rather than random so a restart does not
  // invalidate the session you are in the middle of using.
  JWT_SECRET: 'insecure-development-only-jwt-secret',
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin',
  // ADMIN_EMAIL is deliberately absent. Leaving it unset is what disables the
  // OAuth stage in development; defaulting it would turn that off.
};

/**
 * Fills in missing variables and says loudly which ones it filled. Call this
 * before the Nest application is created, so `validateEnv` sees a complete
 * environment and stays a real check rather than a formality.
 */
export function applyDevelopmentDefaults(): void {
  if (process.env.NODE_ENV === 'production') return;

  const applied = Object.entries(DEVELOPMENT_DEFAULTS).filter(([key]) => !process.env[key]);
  if (applied.length === 0) return;

  for (const [key, value] of applied) {
    process.env[key] = value;
  }

  console.warn(
    [
      '',
      '  ┌─ development defaults in use ─────────────────────────────────────┐',
      ...applied.map(([key]) => `  │  ${key.padEnd(64)}│`),
      '  │                                                                  │',
      '  │  Fine for localhost. Before this leaves your machine, put real   │',
      '  │  values in Doppler and start with `doppler run -- bun run dev`.  │',
      '  └──────────────────────────────────────────────────────────────────┘',
      '',
    ].join('\n'),
  );
}
