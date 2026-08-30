export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Keep in step with main.ts, docker-compose.yml and the vite configs.
  port: Number(process.env.BACKEND_PORT ?? 3100),
  databaseUrl: process.env.DATABASE_URL!,
  frontendUrl: process.env.FRONTEND_URL ?? '',
  adminUrl: process.env.ADMIN_URL ?? '',
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    // Empty outside production disables the OAuth stage — see AuthService.
    adminEmail: process.env.ADMIN_EMAIL ?? '',
    adminUsername: process.env.ADMIN_USERNAME ?? '',
    adminPassword: process.env.ADMIN_PASSWORD ?? '',
  },
  prometheusUrl: process.env.PROMETHEUS_URL ?? 'http://localhost:9090',
});

export type AppConfig = ReturnType<typeof configuration>;
