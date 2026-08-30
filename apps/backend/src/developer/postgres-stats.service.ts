import { Injectable } from '@nestjs/common';
import type {
  ActiveQuery,
  DeveloperSnapshot,
  PostgresOverview,
  ReplicationSlotStat,
  TableStat,
} from '@bestchain/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';

/** `$queryRaw` hands back BigInt for int8/numeric columns; JSON cannot carry those. */
const num = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return Number(String(value));
};

@Injectable()
export class PostgresStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(): Promise<DeveloperSnapshot> {
    const [overview, tables, activeQueries, replicationSlots] = await Promise.all([
      this.overview(),
      this.tables(),
      this.activeQueries(),
      this.replicationSlots(),
    ]);

    return {
      collectedAt: new Date().toISOString(),
      overview,
      tables,
      activeQueries,
      replicationSlots,
    };
  }

  async overview(): Promise<PostgresOverview> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        version()                                              AS version,
        current_database()                                     AS database_name,
        pg_database_size(current_database())                   AS database_size_bytes,
        EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint AS uptime_seconds,
        (SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database())                  AS active_connections,
        (SELECT setting::int FROM pg_settings
          WHERE name = 'max_connections')                      AS max_connections,
        d.blks_hit, d.blks_read, d.xact_commit, d.xact_rollback, d.deadlocks, d.temp_files
      FROM pg_stat_database d
      WHERE d.datname = current_database()
    `;

    const row = rows[0] ?? {};
    const hit = num(row.blks_hit);
    const read = num(row.blks_read);

    return {
      version: String(row.version ?? 'unknown').split(' on ')[0]!,
      databaseName: String(row.database_name ?? ''),
      databaseSizeBytes: num(row.database_size_bytes),
      uptimeSeconds: num(row.uptime_seconds),
      activeConnections: num(row.active_connections),
      maxConnections: num(row.max_connections),
      cacheHitRatio: hit + read === 0 ? 1 : hit / (hit + read),
      transactionsCommitted: num(row.xact_commit),
      transactionsRolledBack: num(row.xact_rollback),
      deadlocks: num(row.deadlocks),
      tempFiles: num(row.temp_files),
    };
  }

  async tables(): Promise<TableStat[]> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        s.schemaname,
        s.relname,
        s.n_live_tup,
        s.n_dead_tup,
        s.seq_scan,
        s.idx_scan,
        s.last_autovacuum,
        pg_total_relation_size(c.oid) AS total_size_bytes,
        pg_indexes_size(c.oid)        AS index_size_bytes
      FROM pg_stat_user_tables s
      JOIN pg_class c ON c.oid = s.relid
      ORDER BY pg_total_relation_size(c.oid) DESC
      LIMIT 50
    `;

    return rows.map((row) => ({
      schema: String(row.schemaname ?? 'public'),
      table: String(row.relname ?? ''),
      rowEstimate: num(row.n_live_tup),
      totalSizeBytes: num(row.total_size_bytes),
      indexSizeBytes: num(row.index_size_bytes),
      sequentialScans: num(row.seq_scan),
      indexScans: num(row.idx_scan),
      deadTuples: num(row.n_dead_tup),
      lastAutovacuum: row.last_autovacuum
        ? new Date(row.last_autovacuum as string).toISOString()
        : null,
    }));
  }

  async activeQueries(): Promise<ActiveQuery[]> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        pid,
        state,
        wait_event_type,
        EXTRACT(EPOCH FROM (now() - query_start))::float8 AS duration_seconds,
        left(query, 500) AS query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND state <> 'idle'
        AND pid <> pg_backend_pid()
      ORDER BY query_start ASC NULLS LAST
      LIMIT 25
    `;

    return rows.map((row) => ({
      pid: num(row.pid),
      state: String(row.state ?? 'unknown'),
      waitEventType: row.wait_event_type ? String(row.wait_event_type) : null,
      durationSeconds: num(row.duration_seconds),
      query: String(row.query ?? '').trim(),
    }));
  }

  async replicationSlots(): Promise<ReplicationSlotStat[]> {
    // Empty on a single-node dev database; the panel renders that as "none".
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        slot_name,
        active,
        pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)::bigint AS lag_bytes
      FROM pg_replication_slots
    `;

    return rows.map((row) => ({
      slotName: String(row.slot_name ?? ''),
      active: Boolean(row.active),
      lagBytes: row.lag_bytes === null ? null : num(row.lag_bytes),
    }));
  }
}
