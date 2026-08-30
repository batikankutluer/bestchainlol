import { useEffect, useState } from 'react';
import type { HealthResponse } from '@bestchain/shared';
import { fetchHealth } from './api.js';

/**
 * Starter page. It exists to prove one thing before you write any product code:
 * that the whole path is wired — browser → nginx → this bundle, and
 * browser → nginx → backend → Postgres. Once the health panel is green, delete
 * this component and build your app.
 */
export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <main className="shell">
      <header>
        <h1>
          It<span className="dot">.</span>works
        </h1>
        <p className="tagline">
          Vite + React on the host, served through nginx, talking to a NestJS backend.
        </p>
      </header>

      <section className="panel">
        <h2>Backend</h2>
        {error && (
          <>
            <p className="status status--down">unreachable — {error}</p>
            <p className="hint">
              The backend starts alongside the frontends under <code>bun run dev</code>.
            </p>
          </>
        )}
        {!error && !health && <p className="status">checking…</p>}
        {health && (
          <>
            <p className={`status status--${health.status}`}>
              {health.status} · {health.service} · up {health.uptimeSeconds}s
            </p>
            <ul className="checks">
              {health.checks.map((check) => (
                <li key={check.name}>
                  <span className={`dot--${check.status}`} />
                  {check.name}
                  {check.latencyMs !== undefined && <em>{check.latencyMs}ms</em>}
                  {check.detail && <em>{check.detail}</em>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Next</h2>
        <ul className="next">
          <li>
            Rename this copy — <code>scripts/rename-project.sh &lt;name&gt; [domain]</code>
          </li>
          <li>
            Replace the placeholder model in <code>apps/backend/prisma/schema.prisma</code>
          </li>
          <li>
            Operations live on the admin domain: <code>/developer</code>, <code>/backrest</code>,{' '}
            <code>/grafana</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
