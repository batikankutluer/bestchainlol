# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# nginx edge. Two targets share one config tree:
#   --target dev  → proxies to the Vite dev servers running on the host
#   --target prod → serves the frontend + admin bundles baked in here
# Build from the repo root: `docker build -f infra/nginx/Dockerfile --target prod .`
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS base
# apache2-utils supplies htpasswd for the basic-auth entrypoint hook.
RUN apk add --no-cache apache2-utils curl
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/snippets/ /etc/nginx/snippets/
COPY infra/nginx/docker-entrypoint.d/ /docker-entrypoint.d/
RUN chmod +x /docker-entrypoint.d/*.sh
# The stock entrypoint renders every *.template found here through envsubst.
ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8081/stub_status || exit 1

# --- development -------------------------------------------------------------
FROM base AS dev
COPY infra/nginx/templates/dev/ /etc/nginx/templates/

# --- frontend bundles --------------------------------------------------------
FROM oven/bun:1.2.21-slim AS build
WORKDIR /app
COPY package.json bun.lock* bunfig.toml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/frontend ./apps/frontend
COPY apps/admin ./apps/admin
# API_URL etc. are baked into the bundle here, so they must be passed at build
# time (the CI job forwards them from Doppler as build args).
ARG API_URL=/api
ARG APP_DOMAIN
ARG ADMIN_DOMAIN
ARG FRONTEND_URL
ARG ADMIN_URL
ENV API_URL=$API_URL APP_DOMAIN=$APP_DOMAIN ADMIN_DOMAIN=$ADMIN_DOMAIN \
    FRONTEND_URL=$FRONTEND_URL ADMIN_URL=$ADMIN_URL
RUN cd apps/frontend && bunx vite build
RUN cd apps/admin && bunx vite build

# --- production --------------------------------------------------------------
FROM base AS prod
COPY infra/nginx/templates/prod/ /etc/nginx/templates/
COPY --from=build /app/apps/frontend/dist /srv/app
COPY --from=build /app/apps/admin/dist /srv/admin
