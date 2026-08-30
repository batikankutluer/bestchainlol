import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { DeveloperModule } from './developer/developer.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HttpMetricsInterceptor } from './metrics/http-metrics.interceptor.js';
import { configuration } from './common/config/configuration.js';
import { validateEnv } from './common/config/env.validation.js';
import { applyDevelopmentDefaults } from './common/config/development-defaults.js';

// Runs before the @Module decorator below, and therefore before
// ConfigModule.forRoot() reads the environment. Placing this in main.ts would
// be too late: imports are fully evaluated before the importing module's body.
applyDevelopmentDefaults();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Doppler injects the environment; there is no .env file to read.
      ignoreEnvFile: true,
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    DeveloperModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
})
export class AppModule {}
