const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'] as const;

// Only meaningful in production, where the OAuth stage cannot be skipped.
const REQUIRED_IN_PRODUCTION = ['ADMIN_EMAIL'] as const;

const MIN_PRODUCTION_PASSWORD_LENGTH = 12;

/**
 * Fail fast rather than boot half-configured.
 *
 * Outside production `applyDevelopmentDefaults()` has already filled these in,
 * so reaching the error here means production — where a missing variable is
 * fatal on purpose and there is nothing safe to guess.
 */
export function validateEnv(config: Record<string, unknown>) {
  const isBlank = (key: string) => {
    const value = config[key];
    return value === undefined || value === null || value === '';
  };

  const required =
    config.NODE_ENV === 'production' ? [...REQUIRED, ...REQUIRED_IN_PRODUCTION] : [...REQUIRED];

  const missing = required.filter(isBlank);

  if (config.NODE_ENV === 'production') {
    const password = String(config.ADMIN_PASSWORD ?? '');

    // The development default is memorable on purpose. Reaching production with
    // it still in place is the single most likely way this stack gets owned.
    if (password === 'admin') {
      throw new Error(
        'ADMIN_PASSWORD is still the development default. Set a real one before deploying.',
      );
    }
    if (password.length > 0 && password.length < MIN_PRODUCTION_PASSWORD_LENGTH) {
      throw new Error(
        `ADMIN_PASSWORD must be at least ${MIN_PRODUCTION_PASSWORD_LENGTH} characters in production.`,
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `In production these must be provided — start the process with ` +
        `\`doppler run -- ...\` or inject them another way.`,
    );
  }

  return config;
}
