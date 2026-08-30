import type { OAuthProvider } from '@bestchain/shared';

export interface VerifiedIdentity {
  email: string;
  provider: OAuthProvider;
}

export interface ProviderDefinition {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  /** Extra parameters the provider needs on the authorize request. */
  authorizeParams?: Record<string, string>;
  /**
   * Returns the account's verified primary email, or null when the provider
   * has one but has not verified it. An unverified address proves nothing —
   * anyone can type someone else's email into a signup form.
   */
  fetchVerifiedEmail(accessToken: string): Promise<string | null>;
}

async function json<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export const PROVIDERS: Record<OAuthProvider, ProviderDefinition> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email',
    authorizeParams: {
      // Force the account chooser: without it Google silently reuses whichever
      // account the browser is already signed into, which is confusing when the
      // whole point is proving you are one specific person.
      prompt: 'select_account',
    },
    async fetchVerifiedEmail(accessToken) {
      const profile = await json<{ email?: string; email_verified?: boolean }>(
        'https://openidconnect.googleapis.com/v1/userinfo',
        { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
      );
      if (!profile.email || profile.email_verified !== true) return null;
      return profile.email;
    },
  },

  github: {
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
    async fetchVerifiedEmail(accessToken) {
      // GitHub keeps emails on a separate endpoint, and the profile's public
      // email may be absent or unverified — this list is the authoritative one.
      const emails = await json<Array<{ email: string; primary: boolean; verified: boolean }>>(
        'https://api.github.com/user/emails',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'bestchain-admin',
          },
        },
      );
      const primary = emails.find((entry) => entry.primary && entry.verified);
      return primary?.email ?? null;
    },
  },
};
