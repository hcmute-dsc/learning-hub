---
name: fix-bug
description: Handle a Learning Hub bug end to end — log it as a `bug` issue with repro/expected/actual, reproduce it, find the root cause, add a regression test, fix through a PR, verify on production and close the issue with root cause, fix and verification. Use whenever something behaves wrong (user report, failing test, error alert, or a bug noticed in passing), even if the fix is one line.
---

# Fix a bug

Every bug leaves a record a new member can read later. Example of a well-closed bug: https://github.com/hcmute-dsc/learning-hub/issues/8

## 1. Log it (before fixing)

Create the issue in the right repo with the `bug` label. Use the template fields from `.github/ISSUE_TEMPLATE/bug_report.yml`:

- the steps to reproduce;
- expected and actual result;
- the environment;
- the impact.

Map the impact to Priority:

| Priority           | When                                    |
| ------------------ | --------------------------------------- |
| `P0 - Gấp`         | site down, data lost or exposed         |
| `P1 - Cao`         | a main feature is unusable              |
| `P2 - Bình thường` | wrong display, or there is a workaround |

Then follow `start-task` steps 3–4. Fill **every** field (`Type=Bug Label=bug`, Priority from the table, Size, Area, Epic, Milestone, Sprint, Assignee, Status), and branch `fix/<issue>-<slug>`:

```bash
bash .claude/skills/start-task/project-item.sh <issue-url> Type=Bug Label=bug "Status=In progress" \
  "Priority=P1 - Cao" Area=Backend Size=S "Epic=Vận hành" Sprint=@current \
  "Milestone=Phase 0 — Dùng thử" Assignee=@me
```

A bug found and fixed on the same day: also pass `Start=<date> Target=<date>` with the real dates.

P0 on production: also add a row to the incident log, learning-hub-docs `docs/ops/DEPLOYMENT.md` §7.

Never paste personal data from logs into the issue (emails, cookies, tokens, IPs). Describe them instead.

## 2. Reproduce and find the root cause

- Reproduce locally or read the production evidence: API logs over SSH (see `deploy/README.md`) or the Discord alert `requestId`.
- Find **why** it happens, not just where.
- Ask "why" until you reach a cause that the fix removes. "Wrong commit shown" is a symptom; "`getTrack` reads the version that last wrote the track row" is a root cause.
- Check whether the same cause breaks other places, and fix or log those too.

## 3. Test first, then fix

- Write a unit test that fails for the bug's reason, then make it pass.
- If the code can't be unit-tested yet (no spec for that module, needs a database), say so in the PR and the issue. Log a follow-up issue to add the test when it is worth it.
- Keep the fix minimal. Refactors go in their own issue and PR.

## 4. Ship and verify

Use `ship-pr`. The PR's **Nguyên nhân gốc** (root cause) section is required for bugs. After merge and deploy, check the exact repro steps on production.

## 5. Close with a resolution comment

If the PR's `Closes` didn't close the issue, close it yourself. Either way, post this comment (Vietnamese, like the rest of the board):

```markdown
**Nguyên nhân gốc:** …
**Cách sửa:** hcmute-dsc/<repo>#<PR> (…một câu…)
**Kiểm tra:** test `<name>`; production sau deploy <commit>: …
```

```bash
gh issue comment <url> --body-file resolution.md
gh issue close <url> --reason completed          # if still open
```

Not reproducible, or won't fix: close with `--reason "not planned"` and explain why. Never close a bug silently.
