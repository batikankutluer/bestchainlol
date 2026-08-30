import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';
import type { AdminAuthConfig, AdminLoginResult, OAuthProvider } from '@bestchain/shared';
import { OAuthService } from './oauth/oauth.service.js';

/** Long enough to type a password, short enough that a leaked link is useless. */
const STAGE_ONE_TTL = '10m';

export interface StageOnePayload {
  stage: 'oauth';
  email: string;
  provider: OAuthProvider;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly oauth: OAuthService,
  ) {}

  /**
   * The OAuth stage is skipped only when there is no ADMIN_EMAIL to check
   * against *and* this is not production. Both halves matter: without the
   * NODE_ENV guard, forgetting to set ADMIN_EMAIL in production would silently
   * drop the stage that proves who you are.
   */
  isOAuthRequired(): boolean {
    const adminEmail = this.config.get<string>('auth.adminEmail')?.trim();
    if (adminEmail) return true;
    return this.config.get<string>('nodeEnv') === 'production';
  }

  authConfig(): AdminAuthConfig {
    return {
      oauthRequired: this.isOAuthRequired(),
      providers: this.oauth.configuredProviders(),
    };
  }

  /**
   * Stage one. The identity is only accepted if the provider says the address
   * is verified (checked upstream) and it matches ADMIN_EMAIL exactly.
   */
  async completeOAuthStage(email: string, provider: OAuthProvider): Promise<string> {
    const expected = this.config.get<string>('auth.adminEmail')?.trim() ?? '';

    if (!expected) {
      // Reachable only in production, where isOAuthRequired() is true with no
      // address to compare against — a misconfiguration, not a failed login.
      this.logger.error('ADMIN_EMAIL is not set; refusing every OAuth sign-in');
      throw new UnauthorizedException('admin sign-in is not configured');
    }

    if (!equalsIgnoringCase(email, expected)) {
      this.logger.warn(`rejected ${provider} sign-in for a non-admin address`);
      throw new UnauthorizedException('that account is not the admin account');
    }

    return this.jwt.signAsync({ stage: 'oauth', email, provider } satisfies StageOnePayload, {
      expiresIn: STAGE_ONE_TTL,
    });
  }

  /**
   * Stage two. `stageOneToken` is required unless the OAuth stage is disabled;
   * passing one when it is disabled is harmless and simply ignored.
   */
  async completePasswordStage(
    username: string,
    password: string,
    stageOneToken: string | null,
  ): Promise<AdminLoginResult> {
    let email: string | null = null;

    if (this.isOAuthRequired()) {
      if (!stageOneToken) {
        throw new UnauthorizedException('sign in with your provider first');
      }
      try {
        const payload = await this.jwt.verifyAsync<StageOnePayload>(stageOneToken);
        if (payload.stage !== 'oauth') throw new Error('wrong stage');
        email = payload.email;
      } catch {
        throw new UnauthorizedException('first stage expired — start again');
      }
    }

    const expectedUsername = this.config.get<string>('auth.adminUsername') ?? '';
    const expectedPassword = this.config.get<string>('auth.adminPassword') ?? '';

    if (!expectedUsername || !expectedPassword) {
      this.logger.error('ADMIN_USERNAME/ADMIN_PASSWORD are not set; refusing every sign-in');
      throw new UnauthorizedException('admin sign-in is not configured');
    }

    // Both compared, and both in constant time, so a wrong username and a wrong
    // password are indistinguishable from outside.
    const usernameOk = timingSafeEqual(username, expectedUsername);
    const passwordOk = timingSafeEqual(password, expectedPassword);

    if (!usernameOk || !passwordOk) {
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({
      sub: email ?? 'admin',
      role: 'admin',
      ...(email ? { email } : {}),
    });

    return { accessToken, role: 'admin' };
  }
}

/** Constant-time comparison, length included, so nothing can be probed. */
function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    // Still burn a comparison so the length check is not a faster path.
    nodeTimingSafeEqual(left, left);
    return false;
  }
  return nodeTimingSafeEqual(left, right);
}

const equalsIgnoringCase = (a: string, b: string) =>
  timingSafeEqual(a.trim().toLowerCase(), b.trim().toLowerCase());
