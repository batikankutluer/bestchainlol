import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MetricSeries } from '@bestchain/shared';

interface PromRangeResponse {
  status: 'success' | 'error';
  error?: string;
  data?: {
    result: Array<{ metric: Record<string, string>; values: Array<[number, string]> }>;
  };
}

/**
 * Thin read-only client for Prometheus. The admin panel never talks to
 * Prometheus directly — that would mean exposing it to the browser, and the
 * whole point of the network split is that only the backend can reach it.
 */
@Injectable()
export class PrometheusService {
  private readonly logger = new Logger(PrometheusService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('prometheusUrl') ?? 'http://localhost:9090').replace(
      /\/+$/,
      '',
    );
  }

  async rangeQuery(
    query: string,
    { minutes = 60, stepSeconds = 30 }: { minutes?: number; stepSeconds?: number } = {},
  ): Promise<Array<{ labels: Record<string, string>; points: Array<{ t: number; v: number }> }>> {
    const end = Math.floor(Date.now() / 1000);
    const start = end - minutes * 60;

    const url = new URL(`${this.baseUrl}/api/v1/query_range`);
    url.searchParams.set('query', query);
    url.searchParams.set('start', String(start));
    url.searchParams.set('end', String(end));
    url.searchParams.set('step', String(stepSeconds));

    let body: PromRangeResponse;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      body = (await response.json()) as PromRangeResponse;
    } catch (error) {
      this.logger.warn(`prometheus unreachable: ${String(error)}`);
      throw new ServiceUnavailableException('prometheus unreachable');
    }

    if (body.status !== 'success' || !body.data) {
      throw new ServiceUnavailableException(body.error ?? 'prometheus query failed');
    }

    return body.data.result.map((series) => ({
      labels: series.metric,
      points: series.values.map(([t, v]) => ({ t, v: Number(v) })),
    }));
  }

  /** The fixed set of postgres series the /developer charts are built from. */
  async postgresSeries(minutes: number): Promise<MetricSeries[]> {
    const queries: Array<{ metric: string; unit: string; expr: string }> = [
      {
        metric: 'connections',
        unit: 'count',
        expr: 'sum(pg_stat_activity_count{datname!=""})',
      },
      {
        metric: 'commits_per_second',
        unit: 'ops/s',
        expr: 'sum(rate(pg_stat_database_xact_commit{datname!=""}[5m]))',
      },
      {
        metric: 'rollbacks_per_second',
        unit: 'ops/s',
        expr: 'sum(rate(pg_stat_database_xact_rollback{datname!=""}[5m]))',
      },
      {
        metric: 'cache_hit_ratio',
        unit: 'ratio',
        expr:
          'sum(rate(pg_stat_database_blks_hit{datname!=""}[5m])) / ' +
          'clamp_min(sum(rate(pg_stat_database_blks_hit{datname!=""}[5m])) + ' +
          'sum(rate(pg_stat_database_blks_read{datname!=""}[5m])), 1)',
      },
      {
        metric: 'deadlocks_per_second',
        unit: 'ops/s',
        expr: 'sum(rate(pg_stat_database_deadlocks{datname!=""}[5m]))',
      },
      {
        metric: 'database_size_bytes',
        unit: 'bytes',
        expr: 'sum(pg_database_size_bytes{datname!=""})',
      },
    ];

    const results = await Promise.allSettled(
      queries.map(async ({ metric, unit, expr }) => {
        const series = await this.rangeQuery(expr, { minutes });
        return { metric, unit, points: series[0]?.points ?? [] } satisfies MetricSeries;
      }),
    );

    // A single missing exporter should degrade one chart, not the whole page.
    return results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  }
}
