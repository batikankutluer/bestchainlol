export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  detail?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  version: string;
  uptimeSeconds: number;
  checks: HealthCheck[];
}
