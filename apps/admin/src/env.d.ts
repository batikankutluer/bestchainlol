/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_ADMIN_DOMAIN: string;
  readonly PUBLIC_APP_URL: string;
  readonly PUBLIC_ADMIN_URL: string;
  readonly PUBLIC_DEV_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
