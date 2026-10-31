#!/usr/bin/env bash
# Prepara la base de PRODUCCIÓN (vacía): migraciones, datos base y verificación.
# Lee DATABASE_URL de .env.production.local (no la imprime). Pide confirmación antes de tocar nada.
#   bash scripts/prod/db-setup.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

FILE=.env.production.local
[ -f "$FILE" ] || { echo "✗ No existe $FILE"; exit 1; }
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$FILE" | head -1 | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')
[[ "$DATABASE_URL" == mysql://* ]] || { echo "✗ DATABASE_URL no está completa en $FILE"; exit 1; }
export DATABASE_URL # gana sobre .env.local y .env (dotenv no pisa variables ya definidas)

HOST=$(node -e 'console.log(new URL(process.argv[1]).hostname)' "$DATABASE_URL")
echo "Base de producción: $HOST"
read -r -p "Esto aplica las migraciones y los datos base (categorías, músculos, ejercicios, insignias). Escribí 'si' para seguir: " OK
[ "$OK" = "si" ] || { echo "Cancelado."; exit 1; }

echo "→ Migraciones"
npx prisma migrate deploy
echo "→ Datos base"
npm run --silent seed
echo "→ Verificación: el schema de la base coincide con prisma/schema.prisma"
if npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code > /dev/null; then
  echo "✓ Sin diferencias"
else
  echo "✗ Hay diferencias entre la base y el schema (correr el diff a mano para verlas)"
  exit 1
fi
echo "✓ Base de producción lista"
