import type { HealthResponse } from '@bestchain/shared';

const API_URL = import.meta.env.PUBLIC_API_URL || '/api';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

/** /health sits outside the /api prefix, so it is addressed off the origin root. */
export function fetchHealth(): Promise<HealthResponse> {
  const base = API_URL.replace(/\/api\/?$/, '');
  return fetch(`${base}/health`).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json() as Promise<HealthResponse>;
  });
}

export { get };
