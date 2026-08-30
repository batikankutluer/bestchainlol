import { useEffect, useState } from 'react';
import type { HealthResponse } from '@bestchain/shared';
import { api } from '../api.js';
import { duration } from '../format.js';
import { externalUrl } from '../links.js';

/**
 * /developer is the only route in this SPA; the rest are served by nginx and
 * never reach the router — hence plain anchors throughout.
 */
const TOOLS = [
  {
    href: '/developer',
    external: false,
    name: 'Developer',
    detail: 'PostgreSQL internals — sizes, connections, cache, slow queries.',
  },
  {
    href: '/backrest/',
    external: true,
    name: 'Backrest',
    detail: 'Backup schedules, snapshots and restores, in its own UI.',
  },
  {
    href: '/grafana/',
    external: true,
    name: 'Grafana',
    detail: 'Dashboards and history over the Prometheus store.',
  },
  {
    href: '/prometheus/',
    external: true,
    name: 'Prometheus',
    detail: 'Raw metric store, targets and alert rules.',
  },
];

export function Overview() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    void api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Operations</h1>
          <p className="muted">Database, metrics, backups and dashboards.</p>
        </div>
      </header>

      <section aria-label="Backend health">
        <h2>Backend</h2>
        {!health ? (
          <p className="muted">unreachable</p>
        ) : (
          <ul className="plain">
            <li>
              status <strong>{health.status}</strong> · version {health.version} · up{' '}
              {duration(health.uptimeSeconds)}
            </li>
            {health.checks.map((check) => (
              <li key={check.name}>
                {check.name} — <strong>{check.status}</strong>
                {check.latencyMs !== undefined && ` (${check.latencyMs}ms)`}
                {check.detail && ` — ${check.detail}`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Tools">
        <h2>Tools</h2>
        <ul className="tools">
          {TOOLS.map((tool) => (
            <li key={tool.href}>
              <a href={tool.external ? externalUrl(tool.href) : tool.href}>
                <strong>{tool.name}</strong>
                <span className="muted">{tool.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
