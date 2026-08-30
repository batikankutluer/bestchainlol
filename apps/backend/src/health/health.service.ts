import { Injectable } from '@nestjs/common';
import type { HealthCheck, HealthResponse, HealthStatus } from '@bestchain/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';

const STARTED_AT = Date.now();

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    const checks: HealthCheck[] = [await this.checkPostgres()];
    const worst: HealthStatus = checks.some((c) => c.status === 'down')
      ? 'down'
      : checks.some((c) => c.status === 'degraded')
        ? 'degraded'
        : 'ok';

    return {
      status: worst,
      service: 'bestchain-backend',
      version: process.env.IMAGE_TAG ?? 'dev',
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      checks,
    };
  }

  private async checkPostgres(): Promise<HealthCheck> {
    const startedAt = performance.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Math.round(performance.now() - startedAt);
      return {
        name: 'postgres',
        status: latencyMs > 500 ? 'degraded' : 'ok',
        latencyMs,
      };
    } catch (error) {
      return {
        name: 'postgres',
        status: 'down',
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
