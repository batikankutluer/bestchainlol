# Cloudflare Tunnel

The tunnel is the only way in. Nothing in `docker-compose.prod.yml` publishes a
port to the internet — `cloudflared` sits alone on the `edge` network with
nginx, so a compromised tunnel reaches exactly one service and cannot see
Postgres, Prometheus or the backup repository at all.

## Token mode (what the compose files use)

1. Cloudflare dashboard → Zero Trust → Networks → Tunnels → **Create a tunnel**.
2. Copy the token into Doppler as `TUNNEL_TOKEN` (`prd` config).
3. Add two public hostnames, both pointing at the same origin:

   | Hostname        | Service           |
   | --------------- | ----------------- |
   | `$APP_DOMAIN`   | `http://nginx:80` |
   | `$ADMIN_DOMAIN` | `http://nginx:80` |

   nginx routes them apart by `Host` header — that is what `server_name` in
   `infra/nginx/templates/prod/*.conf.template` is doing.

4. Put **Cloudflare Access** in front of `$ADMIN_DOMAIN` before it holds
   anything real. The admin token login in the panel is scaffolding, not a
   perimeter.

## Config-file mode (alternative)

If you would rather keep ingress rules in git than in the dashboard, use
`config.yml` in this directory, mount the tunnel credentials JSON, and replace
the compose `command:` with `tunnel --config /etc/cloudflared/config.yml run`.
The credentials file is gitignored — it is a private key.
