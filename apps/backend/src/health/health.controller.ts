import { Controller, Get, HttpCode } from '@nestjs/common';
import type { HealthResponse } from '@bestchain/shared';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @HttpCode(200)
  check(): Promise<HealthResponse> {
    return this.health.check();
  }
}
