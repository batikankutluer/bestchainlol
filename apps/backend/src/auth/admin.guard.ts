import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('missing bearer token');
    }

    try {
      // Stage-one tokens are signed with the same key and would otherwise pass
      // verification. They carry `stage`, never `role`, so requiring role here
      // is what keeps half-finished sign-ins out of the admin API.
      const payload = await this.jwt.verifyAsync<{ role?: string; stage?: string }>(token);
      if (payload.stage) throw new UnauthorizedException('sign-in is not finished');
      if (payload.role !== 'admin') throw new UnauthorizedException('not an admin token');
      return true;
    } catch {
      throw new UnauthorizedException('invalid or expired token');
    }
  }
}
