# HCMUTE DSC Learning Hub

Internal learning platform for HCMUTE Developer Student Club, inspired by Exercism: learn by doing, submit via GitHub, get mentor reviews.

Design docs live in the sibling repo `learning-hub-docs` (PRD, architecture, database, security, backlog). This repo follows those docs; change the docs first when a decision changes.

## Status

MVP-Lite **E1 (foundation)**, **E2 (identity & roles)** and **E3 (content from Git)** are implemented. Also included:

- GitHub OAuth sign-in with PKCE and `state`. New accounts start `pending` unless one of their verified GitHub emails is on the club's email list (`/api/v1/admin/approved-emails`). Admins and mentors can also approve them by hand.
- Server-side sessions: the DB stores only a hashed token.
- Global guards for session, roles, Origin (CSRF) and rate limits.
- Errors use `problem+json`. Audit logs are written from domain events.
- The full MVP schema is defined in Prisma, with CHECK constraints and partial unique indexes added in a separate SQL migration.
- A read-only catalog API (`GET /api/v1/tracks`, `GET /api/v1/tracks/:slug`), and web pages for landing, login, pending, dashboard and tracks.

Content pipeline (E3): `packages/content` parses and validates a content repo. `POST /api/v1/admin/content/sync` (or the `content:sync` CLI) records a draft version with a diff and does not change the catalog. Publish re-reads the same commit and applies the diff in one transaction.

Next (see `MVP-BACKLOG.md`): create `learning-hub-content` and import SQL Challenge, then E4 enrollments/lessons and E5 submissions.

New here? Read [CONTRIBUTING.md](CONTRIBUTING.md): where things are, and the rules that keep the code easy to hand over.

## Layout

```
apps/api        NestJS modular monolith (src/modules/*, src/integrations/*, prisma/)
apps/web        Next.js App Router + Tailwind; proxies /api/* to the api (same origin)
packages/shared Zod schemas, types, constants shared by api and web
packages/content parser + validator for content repos (`hub-content-validate`)
content-example small content repo for local dev and tests
```

Rule: business modules (`src/modules`) never import from `src/integrations`. They depend on ports (for example `modules/identity/ports/identity-provider.ts`), and the integration module binds the adapter.

## Run locally

Requirements: Node 22+, pnpm 9 (`corepack enable` or `npx pnpm@9`), Docker.

```bash
pnpm install
cp .env.example apps/api/.env       # fill GITHUB_CLIENT_ID/SECRET and BOOTSTRAP_ADMIN_GITHUB_LOGIN
docker compose up -d db             # Postgres 16 on localhost:5434
pnpm --filter "./packages/*" build
pnpm --filter @hub/api exec prisma migrate deploy
pnpm db:seed                        # roles only
pnpm --filter @hub/api build
pnpm --filter @hub/api content:sync -- --publish   # demo content from content-example
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
