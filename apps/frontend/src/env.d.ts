/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected by vite.config.ts from the Doppler-provided API_URL. */
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_APP_DOMAIN: string;
  readonly PUBLIC_ADMIN_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
