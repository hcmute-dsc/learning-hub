# Web image (Next.js standalone server). Build from the repo root:
#   docker build -f apps/web/Dockerfile -t learning-hub-web .
# API_INTERNAL_URL is the API's address inside the Docker network: the network alias
# `learning-hub-api` from deploy/docker-compose.prod.yml, unique on purpose because the
# web container also joins the VPS's shared `edge` network. It is needed twice:
# at BUILD time for the /api/* rewrite (compiled into next.config.mjs) and at RUN time
# for the server-side calls in src/lib/api.ts, so both stages set it.

FROM node:22-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- build
FROM base AS build
ARG API_INTERNAL_URL=http://learning-hub-api:4000
ENV API_INTERNAL_URL=$API_INTERNAL_URL NEXT_TELEMETRY_DISABLED=1 NEXT_STANDALONE=1
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hub/shared --filter @hub/web build

# ---- runtime: only the standalone output, static files and public assets
FROM node:22-bookworm-slim AS runtime
ARG API_INTERNAL_URL=http://learning-hub-api:4000
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ENV API_INTERNAL_URL=$API_INTERNAL_URL
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
