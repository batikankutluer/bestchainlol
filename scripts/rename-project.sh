#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Rename a copy of this template to a new project.
#
#   scripts/rename-project.sh <name> [domain]
#   scripts/rename-project.sh topia topia.game
#
# `name` is used for package scope, container names, the database, the metric
# prefix and the Grafana dashboard uids. Keep it lowercase and hyphen-free —
# it ends up inside Prometheus metric names, where only [a-zA-Z0-9_] is legal.
#
# Only mechanical renaming happens here. The starter code that you are meant to
# replace is listed at the end, because a find-and-replace cannot know what your
# app or your data model should be.
# -----------------------------------------------------------------------------
set -euo pipefail

OLD_NAME="bestchain"
OLD_PACKAGE="bestchainlol"
OLD_DOMAIN="bestchain.lol"

NAME="${1:-}"
DOMAIN="${2:-}"

die() { echo "error: $*" >&2; exit 1; }

[ -n "$NAME" ] || die "usage: $0 <name> [domain]"

# The name becomes part of Prometheus metric names, which accept only
# [a-zA-Z_:][a-zA-Z0-9_:]* — a hyphen here produces rules that never match.
[[ "$NAME" =~ ^[a-z][a-z0-9]*$ ]] \
  || die "name must be lowercase letters and digits only (it becomes a metric prefix): got '$NAME'"

[ "$NAME" != "$OLD_NAME" ] && [ "$NAME" != "$OLD_PACKAGE" ] \
  || die "'$NAME' is the template's own name — pick a different one"

DOMAIN="${DOMAIN:-$NAME.local}"

cd "$(git rev-parse --show-toplevel)"

# Refuse to run on a dirty tree: `git diff` afterwards is how you review what
# this did, and `git checkout .` is how you undo it.
if [ -n "$(git status --porcelain)" ]; then
  die "working tree is dirty — commit or stash first, so this rename is reviewable"
fi

grep -q "$OLD_NAME" package.json 2>/dev/null \
  || die "this does not look like the template (no '$OLD_NAME' in package.json)"

echo "renaming: $OLD_PACKAGE -> $NAME    $OLD_DOMAIN -> $DOMAIN"
echo

# Only tracked, non-binary files. git ls-files already honours .gitignore, so
# node_modules and build output are never touched.
FILES="$(git ls-files | while read -r f; do
  [ -f "$f" ] || continue
  grep -Iq . "$f" 2>/dev/null && echo "$f"
done)"

TOUCHED=0
while read -r file; do
  [ -n "$file" ] || continue
  grep -qE "$OLD_NAME|$OLD_PACKAGE" "$file" 2>/dev/null || continue

  # Order matters. The domain goes first because "bestchain.lol" contains
  # "bestchain"; the package name goes next because "bestchainlol" does too and
  # would otherwise be left as "<name>lol".
  perl -pi -e "s/\Q$OLD_DOMAIN\E/$DOMAIN/g;
               s/\Q$OLD_PACKAGE\E/$NAME/g;
               s/\Q$OLD_NAME\E/$NAME/g" "$file"

  echo "  $file"
  TOUCHED=$((TOUCHED + 1))
done <<< "$FILES"

echo
echo "$TOUCHED files rewritten."
echo
echo "Next:"
echo "  bun install                 # workspace names changed; refresh the lockfile"
echo "  git diff                    # review — every change is mechanical"
echo
echo "Placeholders to replace (a rename cannot answer these):"
for f in \
  "apps/backend/prisma/schema.prisma" \
  "apps/backend/prisma/migrations" \
  "apps/frontend/src/App.tsx" \
  "apps/frontend/src/styles.css" \
  "README.md" \
  "CLAUDE.md"
do
  [ -e "$f" ] && echo "  $f"
done
echo
echo "  The schema holds one placeholder User model. Replace it with your own and"
echo "  generate a fresh migration — the existing one has never run against your"
echo "  database, so delete it rather than building on it."
echo
echo "  doppler.yaml is gitignored, so this copy has none. Run \`doppler setup\`"
echo "  to bind it to your own Doppler project."
