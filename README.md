# HCMUTE DSC Learning Hub

Internal learning platform for HCMUTE Developer Student Club, inspired by Exercism: learn by doing, submit via GitHub, get mentor reviews.

Design docs live in the sibling repo `learning-hub-docs` (PRD, architecture, database, security, backlog). This repo follows those docs; change the docs first when a decision changes.

## Status

MVP-Lite **E1 (foundation)** and **E2 (identity & roles)** are scaffolded. Also included:

- GitHub OAuth sign-in with PKCE and `state`. New accounts start `pending` unless they are in the `hcmute-dsc` org or the allowlist.
- Server-side sessions: the DB stores only a hashed token.
- Global guards for session, roles, Origin (CSRF) and rate limits.
- Errors use `problem+json`. Audit logs are written from domain events.
- The full MVP schema is defined in Prisma, with CHECK constraints and partial unique indexes added in a separate SQL migration.
- A read-only catalog API (`GET /api/v1/tracks`, `GET /api/v1/tracks/:slug`), and web pages for landing, login, pending, dashboard and tracks.

Next (see `MVP-BACKLOG.md`): E3 content sync from Git, E4 enrollments/lessons, E5 submissions.

## Layout

```
apps/api        NestJS modular monolith (src/modules/*, src/integrations/*, prisma/)
apps/web        Next.js App Router + Tailwind; proxies /api/* to the api (same origin)
packages/shared Zod schemas, types, constants shared by api and web
```

Rule: business modules (`src/modules`) never import from `src/integrations`. They depend on ports (for example `modules/identity/ports/identity-provider.ts`), and the integration module binds the adapter.

## Run locally

Requirements: Node 22+, pnpm 9 (`corepack enable` or `npx pnpm@9`), Docker.

```bash
pnpm install
cp .env.example apps/api/.env       # fill GITHUB_CLIENT_ID/SECRET and BOOTSTRAP_ADMIN_GITHUB_LOGIN
docker compose up -d db             # Postgres 16 on localhost:5434
pnpm --filter @hub/shared build
pnpm --filter @hub/api exec prisma migrate deploy
pnpm db:seed                        # roles + 2 demo tracks
pnpm dev                            # api :4000, web :3000
```

Open http://localhost:3000. API docs (non-production only): http://localhost:4000/api/docs.

GitHub OAuth app settings:

- Homepage: `http://localhost:3000`
- Callback: `http://localhost:3000/api/v1/auth/github/callback`

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs format, typecheck and tests. It then applies the migrations to an empty Postgres, runs the seed, and builds everything.
