/** Shapes served by the backend's /api/developer/* endpoints and rendered at /developer. */

export interface PostgresOverview {
  version: string;
  databaseName: string;
  databaseSizeBytes: number;
  uptimeSeconds: number;
  activeConnections: number;
  maxConnections: number;
  cacheHitRatio: number;
  transactionsCommitted: number;
  transactionsRolledBack: number;
  deadlocks: number;
  tempFiles: number;
}

export interface TableStat {
  schema: string;
  table: string;
  rowEstimate: number;
  totalSizeBytes: number;
  indexSizeBytes: number;
  sequentialScans: number;
  indexScans: number;
  deadTuples: number;
  lastAutovacuum: string | null;
}

export interface ActiveQuery {
  pid: number;
  state: string;
  waitEventType: string | null;
  durationSeconds: number;
  query: string;
}

export interface ReplicationSlotStat {
  slotName: string;
  active: boolean;
  lagBytes: number | null;
}

export interface DeveloperSnapshot {
  collectedAt: string;
  overview: PostgresOverview;
  tables: TableStat[];
  activeQueries: ActiveQuery[];
  replicationSlots: ReplicationSlotStat[];
}

/** A Prometheus range-query result, flattened for charting. */
export interface MetricSeries {
  metric: string;
  unit: string;
  points: Array<{ t: number; v: number }>;
}
