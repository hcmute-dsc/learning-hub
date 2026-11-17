# API image (NestJS + Prisma). Build from the repo root:
#   docker build -f apps/api/Dockerfile -t learning-hub-api .
# The same image runs the API (default command), the migrations and the content sync
# (see deploy/docker-compose.prod.yml and deploy/README.md).

FROM node:22-bookworm-slim AS base
# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ---- build: install everything, build the shared packages and the API
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hub/shared --filter @hub/content --filter @hub/api build
# A copy of the API with production dependencies only (workspace packages included).
RUN pnpm --filter @hub/api deploy --prod /out \
  && cp -r apps/api/dist /out/dist \
  && cd /out && npx prisma generate

# ---- runtime
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
