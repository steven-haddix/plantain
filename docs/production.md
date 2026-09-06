# Plantain on Coolify

One Dockerfile builds the custom Next.js/Socket.IO application and a separate migration image. Shared PostgreSQL and Redis stay in App Shared Services. The first release starts with fresh data.

## Local production rehearsal

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bash scripts/verify-production.sh
```

The rehearsal uses the exact shared PostgreSQL image digest, a disposable database and restricted role, and Redis 8.6.1. It applies all migrations twice, starts the actual production image, checks HTTP, a signed Better Auth session, access rejection, cache isolation and two-client WebSocket delivery, then restarts the app and checks persistence. It defaults to the production `linux/amd64` runtime; compilation runs natively on the build machine. It publishes no host ports and removes only the containers/volumes/network it created. The private PostgreSQL image requires Docker authentication to GHCR.

## Coolify configuration

- Project: Plantain (`dvyfrlq9eipryftn69mxnzsr`), environment: production.
- Application: plantain-web (`lxuwjznf3uz0znynxcleuzrb`).
- Source: `steven-haddix/plantain`, existing `coolify-haddix` GitHub App.
- Build pack: Dockerfile, location `/Dockerfile`, target `runtime`.
- Resource server: `192.168.1.197`, network `coolify`.
- Port 3000, HTTP health check `/api/health`, start period 30 seconds.
- One replica; automatic deployment stays disabled until the first release is verified.
- Domain is not yet selected. Do not launch with an invented OAuth origin.

Set secrets as **runtime-only**, not build arguments. `.env.example` lists the configuration. The Docker build uses dummy auth/database values and requires no production secrets. The full custom server must run; Next's standalone entrypoint does not include its WebSocket handling.

The shared Redis URL uses hostname `ms4oks080ko48s4sog088wos`, port 6379, DB 0, with `REDIS_NAMESPACE=plantain:prod`. Namespace prefixes separate applications and environments for both keys and chat channels. A different Redis DB number can also organize cache keys, but does not isolate Pub/Sub. These are naming boundaries, not Redis access controls.

## Production database preparation

The saved production connection was verified on 2026-09-06: `plantain_user` already owns `plantain` and has no superuser, create-database, or create-role privileges. Reuse that role and password. The database has pgvector 0.8.2 and a Drizzle migration-history table, with no public application tables. PostGIS still needs installation by the PostgreSQL administrator.

Confirm a recent successful backup before production schema changes. On the resource server, enable the extension in Plantain only:

```sh
sudo docker exec u4og4c0cwg0g8800gss4kgwk \
  psql -X -U postgres -d plantain -v ON_ERROR_STOP=1 \
  -c 'CREATE EXTENSION IF NOT EXISTS postgis;'
```

Before migrating, inspect `drizzle.__drizzle_migrations` and confirm any existing history matches the committed migrations. From the reviewed application checkout on the server, build and run the migration stage. Supply a mode-600 environment file outside the checkout containing only the verified `DATABASE_URL` from Coolify:

```sh
sudo docker build --target migration -t plantain-migration:release .
sudo docker run --rm --network coolify --env-file /path/to/private/plantain.env plantain-migration:release
```

Replace the environment-file path with its actual location. Alternatively, Codex can run the same migration image locally with the verified LAN connection. Run migrations once as a release step; never use `db push`, schema resets, or migration-on-every-web-start. Migrations are intentionally not automatically invoked by Coolify.

## Domain and launch checks

Choose a canonical HTTPS origin, route it through the existing Coolify proxy, and set `BETTER_AUTH_URL` to that origin. Configure Google's authorized redirect URI as `https://YOUR_DOMAIN/api/auth/callback/google` and supply `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. Make sure the OAuth consent configuration permits the intended users.

Deploy the reviewed commit manually. Verify Google login/logout, trip creation and reload, map/place search, itinerary edits, an invitation between two accounts, live team chat, AI streaming, and application restart. An unrelated account must not access a trip or obtain its socket token. Confirm Grimoire remains healthy. Only then enable normal GitHub deployment triggers.

For a failed first deployment, stop the Plantain application and fix it. Later application rollbacks use a compatible previous commit. A database recovery is separate and must target Plantain only; never restore the whole shared cluster to roll back this app.
