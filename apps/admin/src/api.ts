import type {
  AdminAuthConfig,
  AdminLoginResult,
  DeveloperSnapshot,
  HealthResponse,
  MetricSeries,
} from '@bestchain/shared';
import { clearToken, getToken } from './auth.js';

const API_URL = import.meta.env.PUBLIC_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Spread last so a caller-supplied Authorization (the stage-one token
      // during sign-in) overrides the stored session token.
      ...init.headers,
    },
  });

  if (response.status === 401) {
    // The stored JWT expired or the admin token was rotated — force a re-login.
    clearToken();
    throw new ApiError('unauthorized', 401);
  }
  if (!response.ok) {
    throw new ApiError(`${response.status} ${response.statusText}`, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  authConfig: () => request<AdminAuthConfig>('/auth/admin/config'),

  /**
   * Stage two. `stageOneToken` is sent as the bearer instead of the stored
   * session token, which does not exist yet at this point in the flow.
   */
  login: (username: string, password: string, stageOneToken: string | null) =>
    request<AdminLoginResult>('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      headers: stageOneToken ? { Authorization: `Bearer ${stageOneToken}` } : {},
    }),
  session: () => request<{ role: 'admin' }>('/auth/admin/session'),
  developerSnapshot: () => request<DeveloperSnapshot>('/developer/postgres'),
  developerSeries: (minutes: number) =>
    request<MetricSeries[]>(`/developer/postgres/series?minutes=${minutes}`),
  health: () => {
    const base = API_URL.replace(/\/api\/?$/, '');
    return fetch(`${base}/health`).then((r) => r.json() as Promise<HealthResponse>);
  },
};
