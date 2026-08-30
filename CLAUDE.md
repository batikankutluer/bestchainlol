# Platform template

Monorepo on Bun workspaces. Read `README.md` first — it covers the architecture,
the two-terminal dev flow and the network split. This file is the working
agreement on top of it.

This repository is infrastructure, not a product. `apps/frontend/src/App.tsx` is
a starter page and the Prisma schema holds one placeholder model; both are meant
to be deleted by whoever uses this.

## Non-negotiables

**Secrets come from Doppler.** There is no `.env` file and nothing should ever
read one. `.env.example` documents the contract and is never loaded. If a
process needs a new value, add it to `.env.example` _and_ to Doppler.

**Domains are never hardcoded.** `APP_DOMAIN`, `ADMIN_DOMAIN`, `FRONTEND_URL`
and `ADMIN_URL` come from the environment, through to the nginx `server_name`
and the frontend bundles. Do not write a literal domain into a config file.

**Dashboards and alert rules are code.** Grafana runs with
`allowUiUpdates: false`. Edit the JSON in `monitoring/grafana/dashboards`, not
the UI — UI edits are overwritten on restart.

**Both compose files change together.** `docker-compose.yml` and
`docker-compose.prod.yml` describe the same system in two environments. A
service added to one almost always belongs in the other, on the same networks.

## Verifying a change

Anything touching infrastructure needs more than a typecheck. What CI runs, and
what is worth running locally before pushing:

```sh
bun run format:check && bun run typecheck && bun run build
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker run --rm -v "$PWD/monitoring/prometheus:/cfg" \
  --entrypoint promtool prom/prometheus:v2.55.1 \
  check rules /cfg/rules/postgres.yml /cfg/rules/service.yml /cfg/rules/backup.yml
```

Alert rules and PromQL in dashboards refer to metric names that only exist at
runtime. A rule that parses is not a rule that fires — check the expression
against a running Prometheus before trusting it.

## Things that already bit us

Recorded so they are not rediscovered:

- **Grafana under a sub-path** needs `proxy_pass` _without_ a trailing slash.
  With one, it redirects to itself forever.
- **nginx forbids re-declaring a directive in the same context.** Timeouts live
  in `http{}` in `nginx.conf` so individual locations can override them; a
  snippet that hard-codes them makes every location that includes it rigid.
- **Postgres `.sql` init scripts cannot read the environment.** Anything that
  needs an env var has to be a `.sh` script.
- **The vite proxy has to mirror what nginx forwards.** `/health` sits outside
  the `/api` prefix so compose healthchecks and Prometheus can reach it, which
  means a proxy entry for `/api` alone leaves `/health` to the SPA fallback:
  browsing the dev server directly gets `index.html`, and the page reports the
  backend as unreachable with a JSON parse error. Any route added outside the
  global prefix needs an entry in both places.
- **Prisma connection errors carry the whole minified client bundle.** Logging
  the caught error prints ~50 lines of unreadable JavaScript; logging only the
  first line of `error.message` prints the one sentence that matters.
  `PrismaService` does the latter, and in development keeps retrying in the
  background instead of dying — so `bun run dev` and `docker compose up` can be
  started in either order and `/health` reports `down` until the database
  appears. Production still fails fast after bounded retries.
- **A long-running `dev` script in `packages/shared` deadlocks the whole
  workspace.** `bun run --filter '*' dev` starts scripts in workspace dependency
  order, so a `tsc --watch` in shared never finishes and the three apps that
  depend on it never start — silently, with no error at all. `shared` has no
  `dev` script for this reason: it is consumed as source through the vite alias
  and the tsconfig paths, so there is nothing to build or watch, and its type
  errors already surface in each app's own typecheck.
- **The dev backend does not listen on :3000.** It is the most contested port in
  JS development, and a second project holding it makes the backend fail to bind
  while the two frontends come up fine — which reads as "only two of three
  started". `BACKEND_PORT` is the single source: vite's proxy, nginx's upstream
  and the Prometheus dev target all follow it.
- **`docker compose run` does not rebuild.** After editing anything under
  `infra/`, build that service explicitly first.
- **Backrest backs up paths, not databases.** The `pg_dump` hook is what turns a
  path-based backup tool into a database backup, and it only exists because
  `infra/backrest/` adds `postgresql16-client` to the upstream image. Swapping
  back to the stock image silently removes the thing being backed up.

## Style

Match the surrounding code. Comments explain _why_ a thing is the way it is —
the constraint, the failure it prevents — not what the line does. Most of the
comments in `infra/` exist because something surprising is being worked around;
if you remove the workaround, remove the comment.

## Scope

Keep product code out of `infra/`, `monitoring/` and the platform modules in
`apps/backend/src` (health, metrics, developer, backups, auth). Those are what a
new project inherits; anything project-specific mixed into them becomes someone
else's problem on the next copy.
