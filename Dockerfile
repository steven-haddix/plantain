# The custom server handles both Next.js and Socket.IO. Do not use Next's
# standalone entrypoint here: it does not include server.ts.
FROM oven/bun:1.3.3-debian AS bun
FROM --platform=$BUILDPLATFORM oven/bun:1.3.3-debian AS build-bun
FROM node:24.20.0-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Compile JS/assets natively when building the Linux amd64 image on an ARM Mac.
# Runtime dependencies are installed separately for the target architecture.
FROM --platform=$BUILDPLATFORM node:24.20.0-bookworm-slim AS build-dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build-bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM build-dependencies AS build
COPY . .
# Build-time module evaluation needs configuration, but never production
# credentials. Nothing listens at these addresses inside the build container.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:1/plantain \
    BETTER_AUTH_SECRET=build-only-placeholder-not-a-production-secret \
    BETTER_AUTH_URL=http://localhost:3000 \
    bun run build
RUN rm -rf .next/cache

FROM dependencies AS migration
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./
COPY src/db ./src/db
USER node
CMD ["node", "node_modules/drizzle-kit/bin.cjs", "migrate"]

FROM base AS production-dependencies
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/tsconfig.json /app/next.config.ts /app/server.ts ./
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build --chown=node:node /app/.next ./.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/api/health").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
CMD ["node", "--import", "tsx", "server.ts"]
