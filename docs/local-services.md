# Local Services

Plantain can run locally against Dockerized Postgres and Redis.

## Services

- `postgres`: PostgreSQL 17 with both `postgis` and `pgvector` installed
- `redis`: Redis 7 for team chat pub/sub and app caching

## Start the stack

```bash
docker compose up -d --build
```

## Local environment overrides

Keep your existing auth and API keys. Override the infrastructure URLs in `.env.local` with local values:

```bash
DATABASE_URL=postgresql://plantain:plantain@localhost:54329/plantain
REDIS_URL=redis://localhost:6380/0
CHAT_SOCKET_SECRET=plantain-local-chat-secret
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<generate-with-openssl-rand-base64-32>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
```

If you later run the app itself inside Docker, use `postgres` and `redis` as the hostnames instead of `localhost`.

If you want different host ports, override `PLANTAIN_POSTGRES_PORT` and `PLANTAIN_REDIS_PORT` before starting Compose.

## Apply schema

Run the migrations after the containers are healthy:

```bash
bun run db:migrate
```

If you are validating a production-like database before cutover, run the auth audit first:

```bash
bun run auth:audit
```

## Stop the stack

```bash
docker compose down
```

To remove data volumes too:

```bash
docker compose down -v
```
