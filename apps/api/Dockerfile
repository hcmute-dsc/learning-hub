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
# Dependencies first, from the manifests only: this layer and its build cache are reused
# until pnpm-lock.yaml or a package.json changes. Copying the whole repo first made every
# commit reinstall everything and fill the Actions cache (learning-hub#15).
# A new workspace package must be listed here, or the frozen install fails.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/content/package.json packages/content/
COPY packages/shared/package.json packages/shared/
# The api package's postinstall runs `prisma generate`, which needs the schema.
COPY apps/api/prisma/schema.prisma apps/api/prisma/
RUN pnpm install --frozen-lockfile
COPY . .
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
