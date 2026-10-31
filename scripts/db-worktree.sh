#!/usr/bin/env bash
# Uso: npm run db:worktree -- <id> <port>   (ej: w1-1 3011)
# Crea elbravo_<id> y elbravo_<id>_test, escribe .env.local, migra y siembra.
# Lee DATABASE_URL/JWT_SECRET del .env del repo principal (sirve desde cualquier worktree).
set -euo pipefail
ID="${1:?id requerido}"; PORT="${2:?port requerido}"
SAFE="$(echo "$ID" | tr '-' '_')"
MYSQL="${MYSQL_BIN:-/opt/homebrew/opt/mysql@8.4/bin/mysql}"
MAIN_ROOT="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/.." && pwd)"
MAIN_ENV="${MAIN_ENV:-$MAIN_ROOT/.env}"
[ -f "$MAIN_ENV" ] || { echo "No encuentro $MAIN_ENV" >&2; exit 1; }
# (eval y no `source <(...)`: el bash 3.2 de macOS no lee process substitution con source)
eval "$(grep -E '^(DATABASE_URL|JWT_SECRET|JWT_COOKIE_NAME)=' "$MAIN_ENV" | sed 's/^/export /')"
: "${DATABASE_URL:?Falta DATABASE_URL en $MAIN_ENV}"
: "${JWT_SECRET:?Falta JWT_SECRET en $MAIN_ENV}"
BASE="${DATABASE_URL%/*}"
"$MYSQL" -uroot -e "CREATE DATABASE IF NOT EXISTS elbravo_${SAFE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE DATABASE IF NOT EXISTS elbravo_${SAFE}_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cat > .env.local <<EOF
DATABASE_URL="${BASE}/elbravo_${SAFE}"
DATABASE_URL_TEST="${BASE}/elbravo_${SAFE}_test"
JWT_SECRET="${JWT_SECRET}"
JWT_COOKIE_NAME="${JWT_COOKIE_NAME:-elbravo_token}"
PORT=${PORT}
EOF
# Exportar la URL del worktree: el seed usa dotenv/config (solo lee .env), que no pisa variables ya definidas.
export DATABASE_URL="${BASE}/elbravo_${SAFE}"
npx prisma migrate deploy
DATABASE_URL="${BASE}/elbravo_${SAFE}_test" npx prisma migrate deploy
npm run seed
echo "OK: elbravo_${SAFE} y elbravo_${SAFE}_test listas. Dev server: PORT=${PORT} npm run dev"
