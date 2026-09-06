#!/usr/bin/env bash
# Disposable local rehearsal. Never connects to production or publishes ports.
set -euo pipefail
cd "$(dirname "$0")/.."

PG_IMAGE=${PG_IMAGE:-ghcr.io/steven-haddix/coolify-infra-postgres@sha256:733c19c05b3af97dc25dfd655ff1aa02bc7944859e1fffb06dbe1595c0b47bc0}
APP_IMAGE=${APP_IMAGE:-plantain-production-check:local}
MIGRATION_IMAGE=${MIGRATION_IMAGE:-plantain-migration-check:local}
platform=${PLATFORM:-linux/amd64}
suffix="$(date +%s)-$$"
network="plantain-check-$suffix"
postgres="plantain-check-pg-$suffix"
redis="plantain-check-redis-$suffix"
app="plantain-check-app-$suffix"
cleanup() {
  docker rm -fv "$app" "$redis" "$postgres" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker build --platform "$platform" --target migration -t "$MIGRATION_IMAGE" .
docker build --platform "$platform" --target runtime -t "$APP_IMAGE" .
docker network create "$network" >/dev/null
docker run -d --platform linux/amd64 --name "$postgres" --network "$network" --network-alias postgres \
  -e POSTGRES_PASSWORD=disposable-admin-password "$PG_IMAGE" >/dev/null
docker run -d --name "$redis" --network "$network" --network-alias redis \
  redis:8.6.1 >/dev/null

ready=false
for _ in $(seq 1 90); do
  # The entrypoint's temporary initialization server accepts sockets only.
  # Wait for TCP so extension setup has finished and that server has restarted.
  if docker exec "$postgres" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then docker logs "$postgres"; exit 1; fi

docker exec -i "$postgres" psql -X -U postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE ROLE plantain_app LOGIN PASSWORD 'disposable-app-password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE plantain OWNER plantain_app;
\connect plantain
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
SQL
database_url=postgresql://plantain_app:disposable-app-password@postgres:5432/plantain
docker run --rm --platform "$platform" --network "$network" -e DATABASE_URL="$database_url" "$MIGRATION_IMAGE"
# A second migration run must be a no-op, not fail or recreate tables.
docker run --rm --platform "$platform" --network "$network" -e DATABASE_URL="$database_url" "$MIGRATION_IMAGE"
docker exec "$postgres" psql -X -U postgres -d plantain -v ON_ERROR_STOP=1 -c \
  "SELECT version(); SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis','vector'); SELECT count(*) AS applied_migrations FROM drizzle.__drizzle_migrations;"

docker run -d --platform "$platform" --name "$app" --network "$network" \
  -e DATABASE_URL="$database_url" -e REDIS_URL=redis://redis:6379 \
  -e REDIS_NAMESPACE=plantain:rehearsal \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e BETTER_AUTH_SECRET=disposable-rehearsal-auth-secret-at-least-32-characters \
  -e CHAT_SOCKET_SECRET=disposable-rehearsal-chat-secret-at-least-32-characters \
  "$APP_IMAGE" >/dev/null

wait_for_app() {
  for _ in $(seq 1 90); do
    if docker exec "$app" node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))' >/dev/null 2>&1; then return; fi
    sleep 1
  done
  docker logs "$app"
  return 1
}
wait_for_app
docker exec -i "$app" node --import tsx --input-type=module < scripts/smoke-production.mjs
docker restart "$app" >/dev/null
wait_for_app
test "$(docker exec "$postgres" psql -X -U postgres -d plantain -v ON_ERROR_STOP=1 -Atc \
  "SELECT count(*) FROM users WHERE id='production-rehearsal-user';")" = 1
echo "Restart persistence verified."
docker logs --tail 30 "$app"
echo "Production rehearsal passed. Disposable containers and volumes will be removed."
