# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# NestJS backend. Built from the repo root so the workspace + shared package
# resolve: `docker build -f apps/backend/Dockerfile .`
# -----------------------------------------------------------------------------
FROM oven/bun:1.2.21-slim AS base
# Prisma's query engine links against OpenSSL; the slim image does not ship it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- dependencies ------------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock* bunfig.toml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/admin/package.json ./apps/admin/
COPY packages/shared/package.json ./packages/shared/
# --ignore-scripts: `prisma generate` runs in the next stage, once the schema exists.
RUN bun install --frozen-lockfile --ignore-scripts

# --- build -------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend
RUN cd apps/backend && bunx prisma generate

# --- runtime -----------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/backend ./apps/backend
COPY infra/scripts/backend-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /app/apps/backend
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${BACKEND_PORT:-3000}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "src/main.ts"]
