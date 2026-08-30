import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Doppler injects plain (unprefixed) variables into the process, and Vite only
 * exposes VITE_-prefixed ones by default. Rather than duplicate every secret
 * under a VITE_ name, the handful of values the browser is allowed to see are
 * mapped explicitly here — an allowlist, so nothing else can leak into the bundle.
 */
const publicEnv = {
  'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.API_URL ?? '/api'),
  'import.meta.env.PUBLIC_APP_DOMAIN': JSON.stringify(process.env.APP_DOMAIN ?? 'app.localhost'),
  'import.meta.env.PUBLIC_ADMIN_URL': JSON.stringify(
    process.env.ADMIN_URL ?? 'http://admin.app.localhost:8080',
  ),
};

export default defineConfig({
  plugins: [react()],
  define: publicEnv,
  resolve: {
    alias: {
      '@bestchain/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: Number(process.env.FRONTEND_PORT ?? 5173),
    strictPort: true,
    // Mirrors what nginx forwards, so browsing this dev server directly behaves
    // the same as browsing through the edge. /health is deliberately not under
    // /api — it is excluded from the global prefix so compose healthchecks and
    // Prometheus can reach it — so it needs its own entry here. Without one the
    // SPA fallback answers it with index.html and the page reports the backend
    // as unreachable.
    proxy: Object.fromEntries(
      ['/api', '/health'].map((path) => [
        path,
        {
          target: `http://127.0.0.1:${process.env.BACKEND_PORT ?? 3100}`,
          changeOrigin: true,
        },
      ]),
    ),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
