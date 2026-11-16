# Contributing to Learning Hub

This project is maintained by successive generations of HCMUTE DSC members. Write code that the **next** person can understand without asking you.

Design decisions live in [learning-hub-docs](https://github.com/hcmute-dsc/learning-hub-docs). If your change contradicts a doc, update the doc in the same pull request, or first.

## Where things are

```
apps/api/                      NestJS API (modular monolith)
  src/main.ts                  bootstrap: prefix /api/v1, swagger, cookies
  src/app.module.ts            the list of modules (start reading here)
  src/modules/<name>/          one business area per folder (see table below)
  src/integrations/            adapters for the outside world (GitHub, local folder)
  src/common/                  errors, guards, decorators, validation pipe
  src/infrastructure/          env config, Prisma, clock, ids
  src/cli/                     command-line tools (content:sync)
  prisma/schema.prisma         database tables
  prisma/migrations/           SQL migrations (never edit an applied one)
apps/web/                      Next.js app (App Router + Tailwind)
packages/shared/               types + Zod schemas shared by api and web
packages/content/              parser + validator for content repos (pure, no Nest)
content-example/               small content repo used for local dev and tests
```

| API module    | Owns                                                                                                                                              | Read first                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `identity`    | GitHub sign-in, sessions, the global auth guard                                                                                                   | `auth.controller.ts`, `auth.guard.ts`       |
| `users`       | users, roles, approving `pending` accounts                                                                                                        | `users.service.ts`                          |
| `catalog`     | reading published tracks/modules/lessons/exercises; `CatalogWriter` is the only code that writes them                                             | `catalog.service.ts`, `catalog.writer.ts`   |
| `content`     | sync a content repo → draft version → publish                                                                                                     | `content.service.ts`, `domain/plan.ts`      |
| `learning`    | enrollments, lesson progress, track progress and completion; depends on `submissions` and `catalog`                                               | `progress.ts`, `enrollment.service.ts`      |
| `submissions` | submissions and each exercise's state for a member, including prerequisite locks (`exercise-state.ts`); depends on `catalog`, never on `learning` | `exercise-state.ts`, `submission-writer.ts` |
| `audit`       | writes `audit_logs` from domain events                                                                                                            | `audit.listener.ts`                         |

## Rules that keep the code maintainable

1. **One-way dependencies.** A module may use another module's exported service, and never the reverse. For example, `content` uses `catalog`, but `catalog` never imports `content`; and `learning` → `submissions` → `catalog`.
2. **Business code never imports `integrations/`.** It depends on a _port_ (an interface in `modules/<name>/ports/`), and the integration binds the adapter. See `identity/ports/identity-provider.ts` and `content/ports/content-source.ts`.
3. **Business rules are pure functions with tests.** Examples: `checkAccess` (auth.guard.ts), `initialStatus` (users.service.ts), `planChanges` (content/domain/plan.ts) and the whole `packages/content`. If a rule needs a database to be tested, split it.
4. **Errors are `DomainError`s with a stable `code`.** The global filter turns them into `problem+json`. Do not throw raw `Error` for things a user can cause.
5. **Validate at the edge with Zod.** Use schemas from `packages/shared` when the web app needs the same rule.
6. **Side effects go through domain events.** Examples are audit logs and (later) notifications. Use `await this.events.emitAsync(...)`. Listeners catch their own errors.
7. **Comments explain _why_, and point to the design doc section** (e.g. `// SECURITY §5`). Don't comment _what_ the code obviously does.
8. **Small files, plain names, no clever tricks.** Prefer a boring `for` loop over a dense one-liner. Avoid adding dependencies, and add one only with a reason in the PR.

## Everyday commands

pnpm is pinned in `package.json`. If it is not installed, use `npx pnpm@9.15.4` instead of `pnpm`.

```bash
pnpm install
docker compose up -d db                               # Postgres on localhost:5434
pnpm --filter "./packages/*" build                    # shared + content (the api imports their dist/)
pnpm --filter @hub/api exec prisma migrate deploy
pnpm db:seed                                          # roles only
pnpm --filter @hub/api build
pnpm --filter @hub/api content:sync -- --publish      # loads content-example into the catalog
pnpm dev
```

Before opening a PR:

```bash
pnpm format && pnpm typecheck && pnpm test
```

## How to…

**Add an API endpoint.** Add a controller method in the owning module. Validate input with `ZodPipe` and protect it with `@Roles(...)`, or `@Public()` if it is truly public. Put the logic in the service, and add a unit test for any rule.

**Change the database.** Edit `schema.prisma`, then run `pnpm --filter @hub/api exec prisma migrate dev --name <what>`. Put CHECK constraints and partial indexes in a hand-written SQL migration (see `20261116000100_constraints`). Update `DATABASE.md` in the docs repo.

**Change the content format.** Edit `packages/content/src/schemas.ts` and its tests. Update an example under `content-example/` and `CONTENT-SPECIFICATION.md`. Old content must keep working, or the change needs a migration plan.

**Work on content locally.** Edit files in `content-example/`, then run `node packages/content/dist/cli.js content-example`. Then run `pnpm --filter @hub/api content:sync -- --publish`.

## Commits and pull requests

- Use one topic per PR, a short imperative title (`Content: archive removed exercises`) and a description of _why_.
- CI must be green: format, typecheck, tests, migrations on an empty database, seed, content validation and build.
- Never commit `.env` files or secrets.
