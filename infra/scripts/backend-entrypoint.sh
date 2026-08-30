#!/bin/sh
set -e

# Schema migrations run once, at container start, before the app accepts traffic.
# `migrate deploy` only applies committed migrations — it never generates one,
# so a drifted production database fails loudly instead of being rewritten.
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying prisma migrations..."
  bunx prisma migrate deploy
fi

echo "[entrypoint] starting: $*"
exec "$@"
