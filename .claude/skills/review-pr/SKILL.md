---
name: review-pr
description: Review a Learning Hub pull request with the team checklist (correctness, security, design rules, tests, readability, docs) and must/nit comments. Use for self-review before handing a PR to the maintainer, or when asked to review someone's PR in learning-hub, learning-hub-content or learning-hub-docs.
---

# Review a PR

```bash
gh pr view <n> --repo hcmute-dsc/<repo>
gh pr diff <n> --repo hcmute-dsc/<repo>
gh pr checks <n> --repo hcmute-dsc/<repo>
```

Read the linked issue first, then the diff. For a large diff, read the files around the change too, not just the hunks.

## Checklist (in this order)

1. **Correctness.** Does it do what the issue's "Hoàn thành khi" asks? Check edge cases, empty lists, nulls, errors, concurrency in transactions, and timezones (the app shows Vietnam time).
2. **Security** (learning-hub-docs `SECURITY.md`):
   - every new endpoint has `@Roles(...)` or a deliberate `@Public()`;
   - input is validated with Zod;
   - no personal data in logs or Discord messages, and Discord text goes through `escapeDiscord`;
   - no secrets;
   - SQL goes through Prisma, or is parameterised.
3. **Design** (CONTRIBUTING "Rules that keep the code maintainable"):
   - dependencies point one way;
   - business code goes through ports, not `integrations/`;
   - rules are pure functions;
   - errors are `DomainError`;
   - side effects go through events;
   - migrations are new files, never edits.
4. **Tests.** New rules and fixed bugs are covered. Tests check behaviour, not implementation details.
5. **Readability.** Names are plain, files small, no clever tricks. Comments say _why_, and link the doc section.
6. **Docs.**
   - Design docs, `DATABASE.md` and the API notes are updated.
   - Setup or ops changes are in both `deploy/README.md` and `docs/ops/`.
   - The PR body has root cause and testing.

**Content PRs** (learning-hub-content):

- the knowledge is correct;
- every SQL/command runs on the track's setup;
- answers match the questions;
- no `uid` changed;
- sources are credited;
- the Vietnamese is clear and simple.

## Writing the review

- Prefix each comment:
  - `must:` blocks merging (bug, security, broken rule, missing test);
  - `nit:` optional (naming, wording);
  - `question:` when you need the author's intent.
- Point to the line, say what's wrong and why, and suggest the fix. Prefer GitHub suggestion blocks for small changes.
- Verdict: **Approve** when no `must:` remains, otherwise **Request changes**.

```bash
gh pr review <n> --repo hcmute-dsc/<repo> --comment --body-file review.md   # or --approve / --request-changes
```

GitHub doesn't allow approving your own PR. For a self-review, don't post anything: fix the `must:` items and list any `nit:` you left in the hand-off message.
