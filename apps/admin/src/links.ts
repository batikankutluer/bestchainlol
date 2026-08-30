/**
 * Builds a link to something nginx serves but this SPA does not: Grafana,
 * Backrest, Prometheus.
 *
 * Relative by default, so the origin you are browsing stays the origin you end
 * up on — whether that is localhost, the admin hostname, or the real domain in
 * production.
 *
 * The exception is the vite dev server. It serves this SPA on its own port but
 * cannot serve those tools: neither Grafana nor Backrest is published to the
 * host for it to proxy to. From there the link has to point at nginx.
 */
export function externalUrl(path: string): string {
  const devPort = import.meta.env.PUBLIC_DEV_PORT;
  const servedByVite = typeof window !== 'undefined' && window.location.port === devPort;
  if (!servedByVite) return path;

  const origin = (import.meta.env.PUBLIC_ADMIN_URL || '').replace(/\/+$/, '');
  return origin ? `${origin}${path}` : path;
}
