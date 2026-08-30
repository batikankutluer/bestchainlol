import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { PrismaService } from '../common/prisma/prisma.service.js';

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequests: Counter<'method' | 'route' | 'status'>;
  readonly httpDuration: Histogram<'method' | 'route' | 'status'>;

  constructor(private readonly prisma: PrismaService) {
    this.registry.setDefaultLabels({ service: 'bestchain-backend' });
    collectDefaultMetrics({ register: this.registry });

    this.httpRequests = new Counter({
      name: 'bestchain_http_requests_total',
      help: 'Total HTTP requests handled by the backend',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpDuration = new Histogram({
      name: 'bestchain_http_request_duration_seconds',
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  async scrape(): Promise<string> {
    const [app, prisma] = await Promise.all([
      this.registry.metrics(),
      this.prisma.prometheusMetrics().catch(() => ''),
    ]);
    return `${app}\n${prisma}`;
  }
}
