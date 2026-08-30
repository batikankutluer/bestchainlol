import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Same explicit allowlist as the public app — see apps/frontend/vite.config.ts. */
const publicEnv = {
  'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.API_URL ?? '/api'),
  'import.meta.env.PUBLIC_ADMIN_DOMAIN': JSON.stringify(
    process.env.ADMIN_DOMAIN ?? 'admin.app.localhost',
  ),
  'import.meta.env.PUBLIC_APP_URL': JSON.stringify(
    process.env.FRONTEND_URL ?? 'http://app.localhost:8080',
  ),
  // The origin nginx serves this panel on. Tools like Grafana and Backrest live
  // behind nginx and are not published to the host, so links to them have to be
  // absolute — a relative one breaks when browsing the vite port directly.
  //
  // `localhost`, not ADMIN_DOMAIN: the dev nginx config binds the ops panel to
  // both, specifically so tooling links don't depend on ADMIN_DOMAIN resolving
  // (wildcard DNS, /etc/hosts). ADMIN_URL stays reserved for OAuth callbacks
  // and CORS, where the real domain identity matters.
  'import.meta.env.PUBLIC_ADMIN_URL': JSON.stringify(
    `http://localhost:${process.env.NGINX_HTTP_PORT ?? 8080}`,
  ),
  // The port this dev server listens on. Lets the SPA tell "served by vite"
  // from "served through nginx" — the only case where a relative link fails.
  'import.meta.env.PUBLIC_DEV_PORT': JSON.stringify(String(process.env.ADMIN_PORT ?? 5174)),
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
    port: Number(process.env.ADMIN_PORT ?? 5174),
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
