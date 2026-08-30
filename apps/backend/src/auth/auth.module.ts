import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AdminGuard } from './admin.guard.js';
import { OAuthService } from './oauth/oauth.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.jwtSecret'),
        signOptions: { expiresIn: config.get<string>('auth.jwtExpiresIn') ?? '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OAuthService, AdminGuard],
  exports: [JwtModule, AdminGuard],
})
export class AuthModule {}
