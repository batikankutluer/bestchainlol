export const OAUTH_PROVIDERS = ['google', 'github'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export interface AdminAuthConfig {
  /**
   * Whether the OAuth stage is enforced. False only when ADMIN_EMAIL is unset
   * outside production — the local-development escape hatch. In production it
   * is always true, because ADMIN_EMAIL is required there.
   */
  oauthRequired: boolean;
  /** Providers with both a client id and a secret configured. */
  providers: OAuthProvider[];
}

export interface AdminLoginResult {
  accessToken: string;
  role: 'admin';
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
