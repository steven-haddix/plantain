# Plantain production rollout — proposed plan

**Goal:** Deploy the first usable production version of Plantain on the existing Coolify resource server, using the shared PostgreSQL and Redis services.

**Architecture:** One Node application container built from the Plantain GitHub repository. Preserve the custom Next.js/Socket.IO server. Use the existing `plantain` database with a dedicated database role and application-specific Redis namespaces. Coolify supplies HTTPS and deployment management.

**Tech stack:** Next.js 16, React 19, Node, Socket.IO, Better Auth with Google OAuth, Drizzle, PostgreSQL 18 with PostGIS and pgvector, and shared Redis.

**Status:** Production migrations are complete. Plantain is running and healthy in Coolify at commit `0a355da1bbff68ef3ee5fef7bb8abbb976a92cdd`, deployment `dwitgwbtbh8jfts3wjibblr0`. The origin health endpoint returns 200. Cloudflare Tunnel routing still returns 502 and needs correction before public smoke testing.

## Agreed scope and remaining decision

- Production origin: `https://frnd.ing`, via the existing Cloudflare Tunnel. Steven confirmed the tunnel hostname and Google OAuth callback are configured.
- Start with fresh application data; do not import local data. Inspect the existing production `plantain` database before migrating it. If it already contains data, use a new empty Plantain database and retain the existing one instead of wiping it.

## Observed starting point

- No Plantain application currently appears in Coolify's application list.
- The repository has a local database Dockerfile but no application Dockerfile or `.dockerignore`.
- `server.ts` runs Next.js and Socket.IO together on port 3000 and requires Redis before listening.
- `package.json` starts production using `tsx server.ts`, but `tsx` is currently a development dependency.
- Redis cache keys and chat channels currently lack an application/environment namespace.
- Eleven Drizzle migrations are committed. The first creates `vector` and `postgis`; later migrations alter user/authentication data.
- Shared PostgreSQL was upgraded to the tested custom image using the existing volume. PostGIS availability was verified; extension installation in the production `plantain` database still needs checking.
- Local development uses PostgreSQL 17; production migration rehearsal must use PostgreSQL 18 and the tested production image.

## 1. Prepare a deployable application

- [x] Add a root `Dockerfile` with dependency, build, migration, and runtime stages. Pin the chosen supported Node and Bun versions, and install dependencies from `bun.lock` with a frozen lockfile.
- [x] Keep the Node custom server as the runtime entrypoint. Include `server.ts`, its imported source/configuration, `public`, and the Next build output. Set `NODE_ENV=production`, `HOSTNAME=0.0.0.0`, and `PORT=3000`.
- [x] Move `tsx` into production dependencies in `package.json` and update `bun.lock`. Keep migration tooling available in the migration stage.
- [x] Add `.dockerignore` excluding `.env*`, `.git`, local dependencies, build output, backups, and other local artifacts. Add a sanitized `.env.example` listing required variables only.
- [x] Ensure the build works without production credentials or production database access. If module loading needs a database URL, use an unreachable build-only placeholder and verify that no build step queries it.
- [x] Add `src/app/api/health/route.ts` with a lightweight, uncached health response. Verify PostgreSQL and Redis separately during rollout so routine container health checks do not cause restart loops during a shared-service interruption.
- [x] Build and run the production container against disposable PostgreSQL/Redis services, including a restart. Confirm the runtime includes all custom-server imports.

Next.js standalone output does not trace the custom server. Do not replace this server with the generated standalone entrypoint: https://nextjs.org/docs/app/guides/custom-server.

## 2. Prepare application isolation and configuration

- [x] Update `src/lib/redis.ts`, `src/lib/chat/realtime.ts`, and `server.ts` to use a shared configurable namespace, with production set to `plantain:prod`. Apply it consistently to cache reads/writes, channel publication, subscriptions, and channel parsing.
- [x] Verify cache round trips and chat delivery within one namespace, and no cross-environment chat delivery between two namespaces. Do not flush shared Redis.
- [x] Review `src/lib/auth/index.ts`, `src/lib/posthog-server.ts`, and `instrumentation.ts` for production configuration and behavior when optional telemetry is absent.
- [ ] Configure runtime secrets in Coolify: `DATABASE_URL`, `REDIS_URL`, `CHAT_SOCKET_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and provider keys actually required by enabled AI/place-search features.
- [ ] Set `BETTER_AUTH_URL` to `APP_ORIGIN`. Generate distinct production auth and socket secrets. Configure Google OAuth's authorized redirect URI as `APP_ORIGIN/api/auth/callback/google` and verify the intended friends can use the OAuth consent configuration.
- [x] Review dependency advisories for the pinned Next.js/React/auth versions before publishing; apply necessary fixes and validate the resulting build. Do not bundle unrelated framework or AI SDK migrations into deployment work.

Better Auth environment configuration: https://better-auth.com/docs/installation.

## 3. Rehearse and apply database migrations

- [x] Inspect only the production `plantain` database: schemas, tables, installed extensions, migration history, owners, and approximate data volume. Record whether it already contains application data.
- [x] Rehearse all committed migrations on an empty disposable PostgreSQL 18 database. Confirm the later auth/schema migrations also work when applied to a fresh installation.
- [x] Establish a dedicated Plantain login with privileges scoped to its database. Install `postgis` and `vector` administratively if absent; application runtime must not use the shared PostgreSQL superuser.
- [x] Migrate the existing `plantain` database only if inspection confirms it is empty and suitable. Otherwise create a new empty Plantain database with its own role, retain the old database, and point the application to the new one. Do not import local data.
- [x] Before applying production migrations, verify a recent successful backup under the user's accepted approximate 20–30 minute tolerance. The earlier infrastructure backup is not assumed to remain recent at this later rollout.
- [x] Run `drizzle-kit migrate` once from the migration stage with the Plantain connection. Do not use `db push`, reset schemas, or run migrations automatically on every web-container startup.
- [x] Verify migration history, application tables, extension versions, and a spatial/vector query. Confirm existing unrelated services remain healthy.

## 4. Configure and deploy in Coolify

- [x] Create a Plantain project/production environment and one application linked through the existing GitHub App to `steven-haddix/plantain`, branch `main`.
- [x] Use the repository Dockerfile on the existing resource server and network `coolify`. Build the application directly in Coolify; an additional application image registry is not required for this path.
- [x] Configure port 3000, Dockerfile `/api/health` check, one replica, runtime environment variables, and `https://frnd.ing`. Deployment remains manual.
- [ ] Set memory/CPU limits after checking available server headroom and measuring the production container; account for the Next.js build's separate resource demand.
- [ ] Add DNS and TLS using the routing approach already used by the other apps. Verify the reverse proxy supports `/team-chat/socket` upgrades and streamed AI responses.
- [x] Deploy after migrations pass. Commit `0a355da1bbff68ef3ee5fef7bb8abbb976a92cdd`, deployment `dwitgwbtbh8jfts3wjibblr0`, healthy on 2026-09-06. The app temporarily tracks `codex/production-dependency-layer` (PR #3); switch back to main after integration.

## 5. Verify the first release

- [ ] Sign in with Google on the production domain, sign out, and sign in again. Check session persistence after an application restart.
- [ ] Create a trip, search/add a place, add and reorder itinerary items, reload, and confirm saved data and map positions.
- [ ] Use two accounts to invite/join a trip and exchange live team-chat messages. Confirm an unrelated account cannot read or mutate that trip or join its socket room.
- [ ] Exercise AI streaming and the enabled places/hotel search flows using production credentials. Verify failures appear cleanly and logs contain no secrets.
- [ ] Restart the application and confirm saved trips remain available and socket reconnection works.
- [ ] Confirm shared database/Redis and Grimoire remain healthy, then enable the intended GitHub deployment trigger. Keep schema-changing releases coordinated with their migration step.

## Rollback

- Before an initial successful release, stop the Plantain application if verification fails and correct the issue while leaving shared services running.
- For later releases, redeploy the last working application commit when compatible with the current schema.
- Treat database rollback separately: prefer a forward correction; if restoration is necessary, restore only Plantain into an isolated database first, verify it, and explicitly choose the recovery point before switching its connection.
- Never delete the shared PostgreSQL volume or restore the whole cluster to roll back a Plantain application release.

## Work split

- **Codex:** Application packaging and configuration changes, focused verification, migration rehearsal/scripts, Coolify configuration, and deployment checks when implementation/deployment is authorized and access permits.
- **Steven:** Choose the domain; supply production-only secrets; make Google OAuth/DNS changes where account access is unavailable. Initial data policy is already settled: start fresh. If privileged server commands cannot run through available tools, Codex supplies exact commands.

## Preparation results (2026-09-06)

- Coolify project/application created, no domain, auto-deployment disabled, runtime target/port/health configured. Application is stopped.
- Configured runtime-only database and Redis URLs, production namespace, newly generated auth/socket secrets, and the Google AI/Outscraper keys approved for reuse. Google OAuth client configuration and canonical origin remain pending.
- Existing `plantain_user` was verified as the database owner without superuser/createdb/createrole. Existing Drizzle history is empty; no public app tables exist. Vector 0.8.2 and PostGIS 3.6.4 are enabled. All 11 migrations subsequently completed, with zero users/trips and successful spatial/vector checks.
- Exact production PostgreSQL image and linux/amd64 application passed the disposable rehearsal: all 11 migrations, migration rerun, signed Better Auth session, unauthorized/unrelated trip rejection, spatial/vector queries, cache namespace isolation, two-client WebSocket delivery, and persistence after app restart.
- Bun suite: 19 ordinary tests pass; four opt-in Redis tests pass when given a disposable Redis connection. Typecheck passes. The container rehearsal independently exercises cache and chat against Redis 8.6.1.
- Security updates remain within existing framework/AI major versions. The complete lockfile has one moderate esbuild development-server advisory under Drizzle Kit and no critical/high findings. The web runtime excludes Drizzle Kit.
- Added Suspense boundaries around URL-reading header/dashboard components to resolve production prerender failures.
- Review caught and fixed credential-file exclusions in Docker context. Production migrations completed after a fresh Plantain-only backup; no application deployment performed.

Remaining procedure is documented in `docs/production.md`. Reuse the existing database role; do not create a replacement or reset its password.
