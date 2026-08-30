import { Module } from '@nestjs/common';
import { DeveloperController } from './developer.controller.js';
import { PostgresStatsService } from './postgres-stats.service.js';
import { PrometheusService } from './prometheus.service.js';

@Module({
  controllers: [DeveloperController],
  providers: [PostgresStatsService, PrometheusService],
})
export class DeveloperModule {}
