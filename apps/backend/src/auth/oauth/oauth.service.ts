import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { OAUTH_PROVIDERS, type OAuthProvider } from '@bestchain/shared';
import { PROVIDERS } from './providers.js';

interface StatePayload {
  provider: OAuthProvider;
  nonce: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  /** Providers that have both halves of their credentials configured. */
  configuredProviders(): OAuthProvider[] {
    return OAUTH_PROVIDERS.filter((provider) => {
      const { clientId, clientSecret } = this.credentials(provider);
      return Boolean(clientId && clientSecret);
    });
  }

  /**
   * The URL the browser is sent to. `state` is a signed, short-lived JWT rather
   * than a server-side session entry: it survives a restart, needs no storage,
   * and a forged one fails signature verification on the way back.
   */
  async authorizeUrl(provider: OAuthProvider): Promise<string> {
    const { clientId } = this.requireCredentials(provider);
    const definition = PROVIDERS[provider];

    const state = await this.jwt.signAsync(
      { provider, nonce: randomBytes(16).toString('hex') } satisfies StatePayload,
      { expiresIn: '10m' },
    );

    const url = new URL(definition.authorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', this.redirectUri(provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', definition.scope);
    url.searchParams.set('state', state);
    for (const [key, value] of Object.entries(definition.authorizeParams ?? {})) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * Completes the flow: validates the state, trades the code for a token and
   * returns the account's verified email. Throws rather than returning a
   * partial result — every failure here is a failure to authenticate.
   */
  async verifyCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
  ): Promise<{ email: string }> {
    let payload: StatePayload;
    try {
      payload = await this.jwt.verifyAsync<StatePayload>(state);
    } catch {
      throw new UnauthorizedException('invalid or expired state');
    }

    // A state minted for one provider must not be replayed against another.
    if (payload.provider !== provider) {
      throw new UnauthorizedException('state does not match provider');
    }

    const accessToken = await this.exchangeCode(provider, code);
    const email = await PROVIDERS[provider].fetchVerifiedEmail(accessToken);

    if (!email) {
      throw new UnauthorizedException('no verified email on that account');
    }
    return { email };
  }

  private async exchangeCode(provider: OAuthProvider, code: string): Promise<string> {
    const { clientId, clientSecret } = this.requireCredentials(provider);

    const response = await fetch(PROVIDERS[provider].tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // GitHub returns form-encoded unless asked otherwise; Google ignores it.
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: this.redirectUri(provider),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !body.access_token) {
      this.logger.warn(
        `${provider} token exchange failed: ${body.error_description ?? body.error ?? response.statusText}`,
      );
      throw new UnauthorizedException('could not complete sign-in with that provider');
    }
    return body.access_token;
  }

  /**
   * Must match what is registered with the provider, exactly. It is built from
   * ADMIN_URL so there is one place to change when the domain changes.
   */
  redirectUri(provider: OAuthProvider): string {
    const adminUrl = this.config.get<string>('adminUrl');
    if (!adminUrl) {
      throw new BadRequestException('ADMIN_URL must be set for OAuth callbacks to work');
    }
    return `${adminUrl.replace(/\/+$/, '')}/api/auth/oauth/${provider}/callback`;
  }

  private credentials(provider: OAuthProvider) {
    return {
      clientId: process.env[`OAUTH_${provider.toUpperCase()}_CLIENT_ID`] ?? '',
      clientSecret: process.env[`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`] ?? '',
    };
  }

  private requireCredentials(provider: OAuthProvider) {
    const credentials = this.credentials(provider);
    if (!credentials.clientId || !credentials.clientSecret) {
      throw new BadRequestException(`${provider} sign-in is not configured`);
    }
    return credentials;
  }
}
