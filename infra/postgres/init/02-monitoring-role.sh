#!/bin/bash
# Least-privilege role for postgres_exporter: it can read the statistics views
# and nothing else. An exporter never needs to see row data, and giving it the
# application superuser would put the database's own credentials one scrape
# endpoint away from anyone who reaches the observability network.
#
# A .sh init script rather than .sql because only shell can see the container's
# environment — psql has no way to read an env var on its own.
set -euo pipefail

if [ -z "${POSTGRES_MONITORING_PASSWORD:-}" ]; then
  echo "[init] POSTGRES_MONITORING_PASSWORD unset — skipping the monitoring role"
  exit 0
fi

psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname "$POSTGRES_DB" \
     -v monitoring_password="$POSTGRES_MONITORING_PASSWORD" <<'EOSQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitoring') THEN
    CREATE ROLE monitoring WITH LOGIN;
  END IF;
END
$$;

ALTER ROLE monitoring WITH PASSWORD :'monitoring_password';

-- pg_monitor is the built-in bundle: pg_read_all_stats + pg_read_all_settings
-- + pg_stat_scan_tables. It carries no rights over table contents.
GRANT pg_monitor TO monitoring;
-- GRANT wants a database identifier, not an expression, so the name has to be
-- interpolated. The script always runs connected to POSTGRES_DB.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO monitoring', current_database());
END
$$;
EOSQL

echo "[init] monitoring role ready"
