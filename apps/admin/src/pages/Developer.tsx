import { useCallback, useEffect, useState } from 'react';
import type { DeveloperSnapshot, MetricSeries } from '@bestchain/shared';
import { api, ApiError } from '../api.js';
import { bytes, count, duration, percent } from '../format.js';
import { StatTile } from '../components/StatTile.js';
import { MetricChart, MetricTable } from '../components/MetricChart.js';

const RANGES = [
  { label: '15m', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 360 },
  { label: '24h', minutes: 1440 },
];

const SERIES_TITLES: Record<string, string> = {
  connections: 'Active connections',
  commits_per_second: 'Commits',
  rollbacks_per_second: 'Rollbacks',
  cache_hit_ratio: 'Cache hit ratio',
  deadlocks_per_second: 'Deadlocks',
  database_size_bytes: 'Database size',
};

export function Developer({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [snapshot, setSnapshot] = useState<DeveloperSnapshot | null>(null);
  const [series, setSeries] = useState<MetricSeries[]>([]);
  const [minutes, setMinutes] = useState(60);
  const [tableView, setTableView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSnapshot(await api.developerSnapshot());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setError(err instanceof Error ? err.message : String(err));
    }

    // Prometheus being down must not blank the live pg_stat_* section above.
    try {
      setSeries(await api.developerSeries(minutes));
      setSeriesError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return onUnauthorized();
      setSeriesError(err instanceof Error ? err.message : String(err));
    }
  }, [minutes, onUnauthorized]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const overview = snapshot?.overview;
  const connectionLoad = overview ? overview.activeConnections / overview.maxConnections : 0;

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>PostgreSQL</h1>
          <p className="muted">
            Live <code>pg_stat_*</code> from the primary, plus Prometheus history via
            postgres_exporter.
            {snapshot && ` Collected ${new Date(snapshot.collectedAt).toLocaleTimeString()}.`}
          </p>
        </div>
        <button className="btn" onClick={() => void load()} type="button">
          Refresh
        </button>
      </header>

      {error && <p className="banner banner--critical">Snapshot failed — {error}</p>}

      {overview && (
        <section className="tiles" aria-label="Database overview">
          <StatTile
            label="Database size"
            value={bytes(overview.databaseSizeBytes)}
            sub={overview.databaseName}
          />
          <StatTile
            label="Connections"
            value={`${overview.activeConnections} / ${overview.maxConnections}`}
            sub={connectionLoad > 0.8 ? 'near limit' : 'healthy'}
            tone={connectionLoad > 0.8 ? 'critical' : connectionLoad > 0.6 ? 'warning' : 'good'}
          />
          <StatTile
            label="Cache hit ratio"
            value={percent(overview.cacheHitRatio)}
            sub={overview.cacheHitRatio < 0.95 ? 'below target' : 'above target'}
            tone={overview.cacheHitRatio < 0.9 ? 'warning' : 'good'}
          />
          <StatTile
            label="Uptime"
            value={duration(overview.uptimeSeconds)}
            sub={overview.version}
          />
          <StatTile
            label="Commits"
            value={count(overview.transactionsCommitted)}
            sub="since start"
          />
          <StatTile
            label="Rollbacks"
            value={count(overview.transactionsRolledBack)}
            sub="since start"
            tone={
              overview.transactionsRolledBack > overview.transactionsCommitted * 0.05
                ? 'warning'
                : 'neutral'
            }
          />
          <StatTile
            label="Deadlocks"
            value={count(overview.deadlocks)}
            sub={overview.deadlocks > 0 ? 'investigate' : 'none'}
            tone={overview.deadlocks > 0 ? 'critical' : 'good'}
          />
          <StatTile label="Temp files" value={count(overview.tempFiles)} sub="work_mem spills" />
        </section>
      )}

      <section aria-label="Metrics over time">
        <div className="toolbar">
          <h2>History</h2>
          <div className="toolbar__controls">
            <div className="segmented" role="group" aria-label="Time range">
              {RANGES.map((range) => (
                <button
                  key={range.minutes}
                  type="button"
                  className={minutes === range.minutes ? 'is-active' : ''}
                  onClick={() => setMinutes(range.minutes)}
                >
                  {range.label}
                </button>
              ))}
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={tableView}
                onChange={(event) => setTableView(event.target.checked)}
              />
              Table view
            </label>
          </div>
        </div>

        {seriesError && (
          <p className="banner banner--warning">
            Prometheus unavailable — {seriesError}. The snapshot above is read straight from
            Postgres and is unaffected.
          </p>
        )}

        <div className="charts">
          {series.map((item) => {
            const title = SERIES_TITLES[item.metric] ?? item.metric;
            return tableView ? (
              <MetricTable key={item.metric} series={item} title={title} />
            ) : (
              <MetricChart key={item.metric} series={item} title={title} />
            );
          })}
        </div>
      </section>

      {snapshot && (
        <section aria-label="Table statistics">
          <h2>Tables</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">table</th>
                  <th scope="col">rows</th>
                  <th scope="col">total</th>
                  <th scope="col">indexes</th>
                  <th scope="col">seq scans</th>
                  <th scope="col">idx scans</th>
                  <th scope="col">dead</th>
                  <th scope="col">last autovacuum</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.tables.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      no user tables yet — run <code>bun run db:migrate</code>
                    </td>
                  </tr>
                )}
                {snapshot.tables.map((table) => (
                  <tr key={`${table.schema}.${table.table}`}>
                    <td>
                      {table.schema}.<strong>{table.table}</strong>
                    </td>
                    <td className="num">{count(table.rowEstimate)}</td>
                    <td className="num">{bytes(table.totalSizeBytes)}</td>
                    <td className="num">{bytes(table.indexSizeBytes)}</td>
                    <td className="num">{count(table.sequentialScans)}</td>
                    <td className="num">{count(table.indexScans)}</td>
                    <td className="num">{count(table.deadTuples)}</td>
                    <td className="muted">
                      {table.lastAutovacuum
                        ? new Date(table.lastAutovacuum).toLocaleString()
                        : 'never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snapshot && (
        <section aria-label="Active queries">
          <h2>Active queries</h2>
          {snapshot.activeQueries.length === 0 ? (
            <p className="muted">Nothing running right now.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">pid</th>
                    <th scope="col">state</th>
                    <th scope="col">wait</th>
                    <th scope="col">duration</th>
                    <th scope="col">query</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.activeQueries.map((query) => (
                    <tr key={query.pid}>
                      <td className="num">{query.pid}</td>
                      <td>{query.state}</td>
                      <td className="muted">{query.waitEventType ?? '—'}</td>
                      <td className="num">{duration(query.durationSeconds)}</td>
                      <td>
                        <code className="query">{query.query}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {snapshot && snapshot.replicationSlots.length > 0 && (
        <section aria-label="Replication slots">
          <h2>Replication slots</h2>
          <ul className="plain">
            {snapshot.replicationSlots.map((slot) => (
              <li key={slot.slotName}>
                <strong>{slot.slotName}</strong> — {slot.active ? 'active' : 'inactive'}
                {slot.lagBytes !== null && ` · lag ${bytes(slot.lagBytes)}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
