# syntax=docker/dockerfile:1.7
# -----------------------------------------------------------------------------
# Backrest, plus a PostgreSQL client.
#
# Backrest backs up *paths*; it has no idea what a database is. The bridge is a
# hook: before each snapshot it runs pg_dump into a directory, and then snapshots
# that directory. That hook needs pg_dump to exist inside this container, which
# is the only reason this image is not the upstream one unchanged.
# -----------------------------------------------------------------------------
FROM ghcr.io/garethgeorge/backrest:v1.14.1

# Must match the server's major version or pg_dump refuses to run.
RUN apk add --no-cache postgresql16-client

COPY dump-postgres.sh /usr/local/bin/dump-postgres.sh
RUN chmod +x /usr/local/bin/dump-postgres.sh
