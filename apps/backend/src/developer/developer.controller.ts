import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { PostgresStatsService } from './postgres-stats.service.js';
import { PrometheusService } from './prometheus.service.js';

@Controller('developer')
@UseGuards(AdminGuard)
export class DeveloperController {
  constructor(
    private readonly postgres: PostgresStatsService,
    private readonly prometheus: PrometheusService,
  ) {}

  @Get('postgres')
  snapshot() {
    return this.postgres.snapshot();
  }

  @Get('postgres/tables')
  tables() {
    return this.postgres.tables();
  }

  @Get('postgres/activity')
  activity() {
    return this.postgres.activeQueries();
  }

  @Get('postgres/series')
  series(@Query('minutes', new ParseIntPipe({ optional: true })) minutes = 60) {
    return this.prometheus.postgresSeries(Math.min(Math.max(minutes, 5), 60 * 24));
  }
}
