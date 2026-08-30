#!/bin/sh
# -----------------------------------------------------------------------------
# Wire this up in Backrest as a plan hook on CONDITION_SNAPSHOT_START:
#
#   /usr/local/bin/dump-postgres.sh
#
# It writes a single dump at a fixed path. Fixed, not timestamped, because
# restic deduplicates by content and history is the repository's job — a new
# filename per run would defeat both.
# -----------------------------------------------------------------------------
set -eu

DUMP_DIR="${DUMP_DIR:-/dumps}"
PGHOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"

for required in POSTGRES_USER POSTGRES_DB; do
  eval "value=\${$required:-}"
  if [ -z "$value" ]; then
    echo "[dump] FATAL: $required is not set" >&2
    exit 78
  fi
done

export PGPASSWORD="${POSTGRES_PASSWORD:-}"
mkdir -p "$DUMP_DIR"

TARGET="${DUMP_DIR}/${POSTGRES_DB}.dump"

echo "[dump] ${POSTGRES_DB} from ${PGHOST}:${PGPORT} -> ${TARGET}"

# Write to a temporary file and rename: a snapshot must never catch a
# half-written dump, and a failed run must not replace a good one.
pg_dump \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --file="${TARGET}.tmp"

mv "${TARGET}.tmp" "$TARGET"
echo "[dump] done — $(wc -c < "$TARGET") bytes"
