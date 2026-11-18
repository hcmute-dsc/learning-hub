---
name: ship-pr
description: Take a finished Learning Hub change from branch to production the standard way — checks, commit format, PR from the template with Closes, CI, self-review, hand-off for human review and squash merge, then deploy check, production verification and issue Done. Use when a change on a branch is ready, or when the user says commit, push, open PR, ship or deploy.
---

# Ship a change

Assumes `start-task` ran: there is an issue and you are on its branch, not `main`.

## 1. Local checks

```bash
pnpm format && pnpm typecheck && pnpm test        # npx -y pnpm@9.15.4 if pnpm is missing
```

Content repo: run the validator from its CONTRIBUTING. Docs repo: re-read the rendered Markdown, and check that anchors and tables are right.

Also update docs in the same PR (or a linked PR in learning-hub-docs):

- API, behaviour or schema changes;
- setup or ops steps: these go in `deploy/README.md` **and** learning-hub-docs `docs/ops/`.

## 2. Commit

Follow the existing history (`git log --oneline -10`).

```
Area: imperative summary under 72 characters

Why the change is needed (not what the diff already shows).

Refs #<issue>            (or Refs hcmute-dsc/<repo>#<n>)
```

- `Area` names the module or part: `API`, `Web`, `Catalog`, `Content`, `Discord`, `Deploy`, `Runbook`, `CI`, `Ops`. For content commits use the track slug.
- End with the attribution trailer your harness asks for.
- Never commit `.env`, keys or real secrets; check `git status` and `git diff --cached` first.

## 3. Pull request

```bash
git push -u origin HEAD
gh pr create --repo hcmute-dsc/<repo> --base main --title "<commit title>" --body-file pr.md
```

Fill the body from `.github/pull_request_template.md`:

- `Closes #<n>` as the first line (or `Closes hcmute-dsc/<repo>#<n>`).
- Why the change is needed.
- Root cause, for bugs.
- How it was tested.
- The checklist, ticked honestly.

Open it as `--draft` if it is not ready. Keep one topic per PR, and split anything over about 400 changed lines.

## 4. CI and self-review

```bash
gh pr checks <n> --repo hcmute-dsc/<repo> --watch --interval 15
```

Run in the background if your harness supports it.

- Fix red CI by pushing to the same branch; never bypass it.
- Then review your own diff with the `review-pr` checklist (`gh pr diff <n>`), and fix any `must:` before the hand-off.

## 5. Hand off

Give the user:

- the PR link;
- a 2–3 line summary;
- anything not verified.

Ask them to review and merge. Don't merge yourself unless they say so in chat for this PR. Merge with:

```bash
gh pr merge <n> --repo hcmute-dsc/<repo> --squash --delete-branch
```

## 6. After merge: done means live

- **learning-hub:** wait for the Deploy workflow on the merge commit:

  ```bash
  gh run list --repo hcmute-dsc/learning-hub --commit <sha>
  ```

  Then check the change on https://learn.hcmute-dsc.io.vn. Use the user's browser session for pages behind sign-in.

- **learning-hub-content:** a merged change is live only after an admin syncs and publishes it (Quản trị → Nội dung). Publishing is an outward action, so ask first.
- **The issue:** confirm it is closed and on Done. If `Closes` didn't fire, close it with a comment and run `project-item.sh <url> Status=Done`. For bugs, post the resolution comment from `fix-bug`.
- **Locally:** run `git switch main && git pull --ff-only` and delete the local branch.
