# Platform template

A Bun monorepo with the infrastructure already built and verified: a NestJS
backend, two Vite + React frontends (a public app and an operations panel),
nginx at the edge, a Cloudflare tunnel as the only ingress, Prometheus and
Grafana wired to both, and nightly PostgreSQL backups that report their own
freshness.

There is no product here. The app code is a starter page that proves the path
works — browser → nginx → backend → Postgres — and one placeholder Prisma
model. Delete both and build.

---

## Using this as a template

This repository is a GitHub template. "Use this template" gives you a copy;
one script then renames it:

```sh
scripts/rename-project.sh <name> [domain]     # e.g. topia topia.game
bun install                                   # workspace names changed
git diff                                      # every change is mechanical
```

`<name>` must be lowercase letters and digits — it becomes a Prometheus metric
prefix, and those accept nothing else. The script refuses to run on a dirty
tree so `git diff` is always a clean review of what it did.

It renames the mechanical things: package scope, container and image names,
the database, the Grafana dashboard uids, and the metric prefix — which lives
in TypeScript, in the alert rules and in the dashboard JSON at once, so it has
to move in all three or the dashboards go blank.

It does **not** touch application code, which is where your own naming will
live. After renaming, the things to replace are the placeholder `User` model in
`apps/backend/prisma/schema.prisma`, the starter page in
`apps/frontend/src/App.tsx`, and this README.

---

## Running it

A fresh clone runs with no configuration at all:

```sh
bun install
docker compose up -d --build     # terminal 1: postgres, prometheus, grafana, nginx, backups
bun run db:deploy                # once, to create the schema
bun run dev                      # terminal 2: backend + both frontends, hot reload
```

Then:

| URL                         | What                                                     |
| --------------------------- | -------------------------------------------------------- |
| `http://localhost:8080`     | operations panel — `/developer`, `/backrest`, `/grafana` |
| `http://app.localhost:8080` | the public app                                           |

In development the bare `localhost` is the operations panel, because that is the
URL you type when you want a tool. Production has no such shortcut: cloudflared
maps a real subdomain to each and nginx splits them by `Host` alone.

Every value has a development default — an obviously insecure one, announced in
the backend's startup output. That is deliberate: a secret manager should not
stand between a clone and the first green health check.

Once the stack leaves your machine, put real values in Doppler and prefix both
commands. Nothing else changes:

```sh
doppler setup                                 # once per machine
doppler run -- bun run dev
doppler run -- docker compose up -d --build
```

In production the defaults do not apply at all: a missing variable is fatal, and
`docker-compose.prod.yml` carries no fallbacks. The convenience is scoped to
development on purpose.

The apps run on the host rather than in containers. Hot reload is instant, a
debugger attaches normally, and `bun --watch` restarts in milliseconds. nginx
bridges the two halves by proxying to `host.docker.internal`, so the URL you
develop against has the same shape as production — same hostnames, same paths,
same `/api` prefix. A route that works here works there.

`.env.example` lists every variable the stack reads. It is documentation, never
loaded.

## Layout

```
apps/
  backend/      NestJS + Prisma. Health, metrics, admin auth, /developer data.
  frontend/     Vite + React. The public app.
  admin/        Vite + React. Operations panel — /developer, and links out.
packages/
  shared/       Types both ends agree on: health, developer, backup.
infra/
  nginx/        Edge. Two build targets, one config tree (dev proxies, prod serves).
  backrest/     Backrest image, extended with pg_dump for the backup hook.
  postgres/     Init scripts: extensions, least-privilege monitoring role.
  cloudflared/  Tunnel documentation and config-file alternative.
  scripts/      Container entrypoints.
monitoring/
  prometheus/   Scrape config, per-environment targets, alert rules.
  grafana/      Provisioned datasource and dashboards (dashboards are code).
```

## The two domains

`$APP_DOMAIN` serves the public app. `$ADMIN_DOMAIN` serves the operations
panel and everything behind it. nginx separates them by `server_name`, so both
hostnames can point at the same tunnel. In development the admin server also
answers on `localhost` and is the default server.

| Path on `$ADMIN_DOMAIN` | What it is                                                     | Guarded by                       |
| ----------------------- | -------------------------------------------------------------- | -------------------------------- |
| `/`                     | admin SPA                                                      | two-stage sign-in                |
| `/developer`            | PostgreSQL internals — sizes, connections, cache, slow queries | two-stage sign-in                |
| `/grafana`              | dashboards and history                                         | Grafana's own login              |
| `/prometheus`           | raw metric store, targets, alert rules                         | nginx basic auth                 |
| `/backrest`             | Backrest — backup schedules, snapshots, restores               | nginx basic auth + its own login |

### Signing in

Two stages. First the operator proves who they are with Google or GitHub, and
the provider-verified address must equal `ADMIN_EMAIL`. Then they enter
`ADMIN_USERNAME` and `ADMIN_PASSWORD`. Neither stage alone gets you in: an
attacker with the password still needs the mailbox, and access to the mailbox
still needs the password.

The first stage is skipped when `ADMIN_EMAIL` is empty **and** `NODE_ENV` is not
production — that is the local-development case, where the panel opens straight
onto the credential form. In production `ADMIN_EMAIL` is required and the
backend refuses to start without it, so the stage cannot be lost by accident.

Development credentials default to `admin` / `admin`. Production refuses to
start if that password survived, or if it is shorter than 12 characters.

Register this redirect URI with each provider, exactly:

```
$ADMIN_URL/api/auth/oauth/<provider>/callback
```

This is still application-level auth. Put Cloudflare Access in front of
`$ADMIN_DOMAIN` as well before it guards anything real.

## Network separation

Four Docker networks, and one rule that does the real work: **`cloudflared`
sits only on `edge`**. The single process reachable from the internet can reach
nginx and nothing else — not Postgres, not Prometheus, not the backup
repository.

| Network         | Members                                        |
| --------------- | ---------------------------------------------- |
| `edge`          | cloudflared, nginx                             |
| `app`           | nginx, backend                                 |
| `data`          | postgres, backend, postgres-exporter, backrest |
| `observability` | prometheus, grafana, exporters, backend, nginx |

In production `data` is `internal: true` — no route off the host at all — and
nothing publishes a port beyond `127.0.0.1`.

## Backups

[Backrest](https://github.com/garethgeorge/backrest) orchestrates restic and
brings its own web UI, reachable at `/backrest` on the admin domain. Schedules,
retention and restores all live there rather than in a script in this
repository.

Backrest backs up **paths**, not databases. The bridge is a hook: before each
snapshot it runs `pg_dump` into a directory, and then snapshots that directory.
That is the one piece this repository supplies — `infra/backrest/` is the
upstream image plus `postgresql16-client` and the hook script.

### First run

Open `/backrest`, create the Backrest account, then:

1. **Add a repository.** `/repos/<name>` for a local one, or an S3/R2 URI for
   off-site. Backrest generates and stores the encryption password — keep a copy
   somewhere that survives losing this host, because losing it loses every
   backup.
2. **Add a plan** backing up `/dumps`, on whatever schedule and retention policy
   you want.
3. **Add a hook** to that plan, on `CONDITION_SNAPSHOT_START`, running:

   ```
   /usr/local/bin/dump-postgres.sh
   ```

   It reads `POSTGRES_*` from the container environment, which compose already
   provides, and writes `/dumps/<database>.dump`.

`bun run backup:dump` runs that hook by hand when you want a dump without
waiting for the schedule.

### Restoring

Browse the snapshot in Backrest and restore `/dumps/<database>.dump`, then:

```sh
createdb restore_check      # never restore over the live database first
pg_restore --no-owner --no-privileges -d restore_check <database>.dump
```

Untested restores are not backups. Run this against a scratch database on a
schedule, not for the first time during an incident.

## Monitoring

Prometheus scrapes six targets: the backend, postgres-exporter, node-exporter,
nginx-exporter, Grafana, and itself. Eleven alert rules cover database health,
HTTP error rate and latency, disk, and backup freshness.

Grafana is provisioned from `monitoring/grafana` with `allowUiUpdates: false` —
dashboards are code, and edits made in the UI are overwritten on restart. Two
ship: PostgreSQL, and Service & Host.

`postgres-exporter` logs in as a dedicated `monitoring` role holding only
`pg_monitor`. An exporter never needs to see row data, and giving it the
application's own credentials would put them one scrape endpoint away from
anyone who reaches the observability network.

## Database

Prisma, with a single placeholder `User` model. It is there so the plumbing is
demonstrably working before you write anything real: migrations apply, the pool
opens, Prisma's own counters reach `/metrics`, and `/developer` has a table to
report on. Replace it and generate a fresh migration — nothing in the existing
one is worth keeping.

```sh
bun run db:migrate     # create + apply a migration
bun run db:studio      # browse
```

Migrations are applied by the backend's entrypoint at container start, so a
deploy cannot forget them. `prisma migrate deploy` only applies committed
migrations — a drifted production database fails loudly instead of being
rewritten.

## CI/CD

`ci.yml` runs on every push and PR: format, typecheck, build, migrations
against a clean Postgres, a schema-drift check, both compose files, `promtool`
over the alert rules, and `nginx -t` over the rendered templates.

`deploy.yml` runs on a **self-hosted runner** on the box itself, so images never
leave the machine and no SSH key or registry credential has to exist anywhere.
It takes a backup before it touches anything — a deploy that runs migrations
without a fresh snapshot has no undo — then builds, rolls out, waits for health,
and reloads Prometheus. It needs one secret: `DOPPLER_TOKEN_PRD`.

## Troubleshooting

**`bun run dev` exits complaining about missing variables.** It was started
without `doppler run --`. The backend validates its required environment at
boot rather than failing later in a confusing way.

**`The service was stopped: write EPIPE` from Vite.** macOS killed the esbuild
binary because a reinstall broke its code signature. Re-sign it:

```sh
codesign --force --sign - node_modules/@esbuild/*/bin/esbuild
```

**Grafana redirects `/grafana/` to itself forever.** `proxy_pass` grew a
trailing slash somewhere. Stripping the prefix makes Grafana add it back.

**Prometheus shows the backend target down in dev.** The dev target is rendered
from `BACKEND_PORT` by the `prometheus-targets` service. If you changed the
port, `docker compose up -d prometheus-targets prometheus`.
