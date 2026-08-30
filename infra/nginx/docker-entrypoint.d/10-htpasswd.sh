#!/bin/sh
set -e

# Generates the basic-auth file that guards /prometheus from the
# Doppler-provided credentials. Kept out of the image and out of git on purpose:
# rotating the secret in Doppler and restarting nginx is the whole rotation.
if [ -z "${NGINX_BASIC_AUTH_USER:-}" ] || [ -z "${NGINX_BASIC_AUTH_PASSWORD:-}" ]; then
  echo "[nginx] NGINX_BASIC_AUTH_USER/PASSWORD unset — /prometheus will reject everyone" >&2
  : > /etc/nginx/.htpasswd
  chown root:nginx /etc/nginx/.htpasswd
  chmod 640 /etc/nginx/.htpasswd
  exit 0
fi

htpasswd -bcB /etc/nginx/.htpasswd "$NGINX_BASIC_AUTH_USER" "$NGINX_BASIC_AUTH_PASSWORD" >/dev/null 2>&1
# This hook runs as root but the workers that read the file run as `nginx`.
# Group-readable rather than world-readable: it holds a bcrypt hash.
chown root:nginx /etc/nginx/.htpasswd
chmod 640 /etc/nginx/.htpasswd
echo "[nginx] basic auth configured for user '${NGINX_BASIC_AUTH_USER}'"
