import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { isOAuthProvider } from '@bestchain/shared';
import { AuthService } from './auth.service.js';
import { OAuthService } from './oauth/oauth.service.js';
import { AdminLoginDto } from './admin-login.dto.js';
import { AdminGuard } from './admin.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly config: ConfigService,
  ) {}

  /** Lets the panel render the right first screen without guessing. */
  @Get('admin/config')
  authConfig() {
    return this.auth.authConfig();
  }

  /** Stage one: hand the browser off to the provider. */
  @Get('oauth/:provider')
  async start(@Param('provider') provider: string, @Res() res: Response) {
    if (!isOAuthProvider(provider)) throw new BadRequestException('unknown provider');
    res.redirect(await this.oauth.authorizeUrl(provider));
  }

  /**
   * Stage one, continued. Ends in a redirect either way — the browser arrives
   * here from the provider, so there is nobody to read a JSON error.
   */
  @Get('oauth/:provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (!isOAuthProvider(provider)) throw new BadRequestException('unknown provider');
    const adminUrl = (this.config.get<string>('adminUrl') ?? '').replace(/\/+$/, '');

    if (error || !code || !state) {
      return res.redirect(`${adminUrl}/#error=${encodeURIComponent(error ?? 'sign-in cancelled')}`);
    }

    try {
      const { email } = await this.oauth.verifyCallback(provider, code, state);
      const stageOneToken = await this.auth.completeOAuthStage(email, provider);
      // The token rides in the fragment, which browsers do not send to servers
      // and do not put in the Referer header — unlike a query string, which
      // would land in every access log between here and the browser.
      return res.redirect(`${adminUrl}/#stage1=${encodeURIComponent(stageOneToken)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'sign-in failed';
      return res.redirect(`${adminUrl}/#error=${encodeURIComponent(message)}`);
    }
  }

  /** Stage two: username and password, gated on stage one unless it is disabled. */
  @Post('admin/login')
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto, @Headers('authorization') authorization?: string) {
    const stageOneToken = extractBearer(authorization);
    return this.auth.completePasswordStage(dto.username, dto.password, stageOneToken);
  }

  /** Lets the panel decide on boot whether a stored token is still good. */
  @Get('admin/session')
  @UseGuards(AdminGuard)
  session() {
    return { role: 'admin' as const };
  }
}

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
