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
checker-example/               stand-in for the private checker repo: reference solutions (dev, tests)
```

| API module    | Owns                                                                                                                                                       | Read first                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `identity`    | GitHub sign-in, sessions, the global auth guard                                                                                                            | `auth.controller.ts`, `auth.guard.ts`       |
| `users`       | users, roles, approving `pending` accounts                                                                                                                 | `users.service.ts`                          |
| `catalog`     | reading published tracks/modules/lessons/exercises; `CatalogWriter` is the only code that writes them                                                      | `catalog.service.ts`, `catalog.writer.ts`   |
| `content`     | sync a content repo → draft version → publish                                                                                                              | `content.service.ts`, `domain/plan.ts`      |
| `learning`    | enrollments, lesson progress, track progress and completion; depends on `submissions` and `catalog`                                                        | `progress.ts`, `enrollment.service.ts`      |
| `submissions` | submissions and each exercise's state for a member, including prerequisite locks (`exercise-state.ts`); depends on `catalog`, never on `learning`          | `exercise-state.ts`, `submission-writer.ts` |
| `reviews`     | mentor review: queue (filters, mentor numbers), claim/release, complete; depends on `submissions` (owns the status change), `catalog`, `learning`, `users` | `review-rules.ts`, `reviews.service.ts`     |
| `audit`       | writes `audit_logs` from domain events; `AuditReader` serves the admin "Nhật ký" page (names via `UsersService.refsByIds`)                                 | `audit.listener.ts`, `audit.reader.ts`      |
| `overview`    | admin `/admin` overview: asks `users`, `content`, `submissions` and `audit` for counts only (no names or emails)                                           | `overview.ts`, `overview.service.ts`        |

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
pnpm format && pnpm lint && pnpm typecheck && pnpm test   # lint includes the dependency-direction check
```

## How to…

**Add an API endpoint.** Add a controller method in the owning module. Validate input with `ZodPipe` and protect it with `@Roles(...)`, or `@Public()` if it is truly public. Put the logic in the service, and add a unit test for any rule.

**Change the database.** Edit `schema.prisma`, then run `pnpm --filter @hub/api exec prisma migrate dev --name <what>`. Put CHECK constraints and partial indexes in a hand-written SQL migration (see `20261116000100_constraints`). Update `DATABASE.md` in the docs repo.

**Change the content format.** Edit `packages/content/src/schemas.ts` and its tests. Update an example under `content-example/` and `CONTENT-SPECIFICATION.md`. Old content must keep working, or the change needs a migration plan.

**Work on content locally.** Edit files in `content-example/`, then run `node packages/content/dist/cli.js content-example`. Then run `pnpm --filter @hub/api content:sync -- --publish`.

## Workflow: issue → branch → PR → review → merge

All work is tracked on the org board [DSC Learning Hub · Project #1](https://github.com/orgs/hcmute-dsc/projects/1). The full process (fields, sprints, bug lifecycle) is in [WORKFLOW.md](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/WORKFLOW.md). In short:

1. **Issue first.** Every change starts from an issue (use the templates). Look for an existing one before opening a new one. Assign yourself and set Status = In progress.
2. **Branch** from up-to-date `main`: `<type>/<issue>-<short-slug>`.
   - `type`: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
   - Issue in another repo: prefix it, e.g. `chore/docs-4-work-standards`.
   - Examples: `fix/8-track-source-commit`, `feat/3-sql-checker`.
3. **Commits**: `Area: imperative summary` (≤ 72 characters), e.g. `Catalog: show the published commit on the track page`.
   - `Area` is the module or part you touched: `API`, `Web`, `Catalog`, `Content`, `Discord`, `Deploy`, `Runbook`, `CI`…
   - The body says _why_, and ends with `Refs #8` (or `Refs hcmute-dsc/learning-hub-docs#4`).
   - Small, self-contained commits. No "wip" or "fix typo" commits in the final PR: squash them locally or let the squash merge do it.
4. **Pull request** from the template.
   - Title in the commit format.
   - First line `Closes #<n>` (or `Closes hcmute-dsc/<repo>#<n>`), so merging closes the issue and moves it to Done.
   - One topic per PR, ideally under ~400 changed lines. Split bigger work.
   - Open it as a **draft** while you are still working.
5. **CI must be green**: format, typecheck, tests, migrations on an empty database, seed, content validation and build. CI also checks:
   - **Secrets**: gitleaks scans the whole git history. A secret on the branch turns the PR red even after a later commit deletes it, so rotate the secret, then rewrite the branch history.
   - **Dependency direction**: `node scripts/check-boundaries.mjs` fails when code in `apps/api/src/modules` imports `integrations/` (rule 2 below). Only a `*.module.ts` may import an integration's `*.module` to bind the adapter.
   - **PR title** (workflow `PR title`): `Area: imperative summary`, at most 72 characters, no `WIP`, no full stop. Fix the title on GitHub and the check re-runs. No local hook is needed.
6. **Review** (below), then **squash merge**. The PR title becomes the commit on `main`. Delete the branch.

Never push directly to `main`. A production hotfix still goes through a PR. If the reviewer is not available, merge it yourself after CI is green, and ask for a review afterwards in the PR.

### Bugs

- Every bug gets an issue labelled `bug` (template: steps, expected, actual, impact). This includes a bug you find and fix in the same hour.
- The fix PR adds a test that fails without the fix whenever the code can be unit-tested. If it can't, say why in the PR.
- The PR (or a closing comment on the issue) records:
  - the **root cause**;
  - the **fix**;
  - **how it was verified** (tests; production after deploy).
- Incidents on production are also logged in [DEPLOYMENT §7](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/DEPLOYMENT.md).

### Code review

The reviewer checks, in this order:

1. **Correctness**: does it do what the issue asks? Edge cases, errors, empty states.
2. **Security**: access checks (`@Roles`/`@Public`), input validated with Zod, no personal data in logs or Discord, no secrets.
3. **Design**: the module rules above (one-way dependencies, ports, pure rules, `DomainError`, events).
4. **Tests**: new rules and fixed bugs are covered.
5. **Readability**: a new member can follow it; comments explain _why_.
6. **Docs**: design docs, `DATABASE.md` and `deploy/README.md` are updated when behaviour, schema or operations change.

How to comment:

- Prefix blocking comments with `must:` and optional ones with `nit:`.
- Approve when no `must:` comments are left.
- The author resolves each thread, or answers it, before merging.

### Definition of done

- The PR is merged and CI is green.
- The change is deployed (Deploy workflow green) and checked on production when users can see it.
- The issue is closed and its Status is Done on the project.
- Docs are updated.

Never commit `.env` files or secrets.
