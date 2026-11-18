# Rules for coding agents (Claude Code, Codex, Cursor…)

This repo is maintained by successive generations of HCMUTE DSC members. Agents follow the same process as people; the human-readable version is [CONTRIBUTING.md](CONTRIBUTING.md) and [WORKFLOW.md](https://github.com/hcmute-dsc/learning-hub-docs/blob/main/docs/ops/WORKFLOW.md). Read CONTRIBUTING before changing code.

## Non-negotiable

1. **No issue, no work.** Every request (feature, bug, chore, docs) maps to an issue on org Project #1 before any edit. Find an existing one first. Skill: `start-task`. Fill **every** sidebar field (type, label, milestone, assignee, board fields, sprint, org Priority/Effort, dates) with `project-item.sh`; a half-filled issue is not acceptable.
2. **Every bug is logged**, including one you notice and fix in passing. Skill: `fix-bug`.
   - The issue has: repro, expected, actual.
   - The fix has a regression test, or a written reason why there isn't one.
   - Closing records the root cause, the fix and how it was verified.
3. **Never push to `main`.** Branch `<type>/<issue>-<slug>`, commits `Area: imperative summary` + `Refs #n`, PR from the template with `Closes #n`, CI green, review, squash merge. Skill: `ship-pr`.
4. **Review every PR automatically, then the human merges.** After CI is green, review your own PR with the `review-pr` checklist, fix every `must:`, and post the review on the PR as a comment (learning-hub#22). Then ask the maintainer to review and merge. Don't merge, change repo settings or branch protection, or touch production without an explicit yes in chat.
5. **Done means live.** After merge: Deploy workflow green, check the change on https://learn.hcmute-dsc.io.vn, issue closed and Done on the board.
6. **Docs move with code.**
   - Behaviour, API or schema changes update learning-hub-docs.
   - Every setup or operations guide goes in **both** `deploy/README.md` and learning-hub-docs `docs/ops/`.
7. **Public repos.** Never write secrets, the VPS IP, webhook URLs, cookies or member emails into code, commits, issues, PRs or logs. Never ask a person to paste a secret into chat. Use `gh secret set` and let them type it.

## Commands

pnpm is pinned. If it isn't installed, use `npx -y pnpm@9.15.4`.

```bash
pnpm format && pnpm typecheck && pnpm test     # before every PR
pnpm --filter @hub/api test                     # API unit tests only
```

Local setup, module map and code rules: [CONTRIBUTING.md](CONTRIBUTING.md). Production and deploy: [deploy/README.md](deploy/README.md).

## Skills in this repo (`.claude/skills/`)

| Skill        | Use when                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| `start-task` | any new request: find/create the issue, put it on the board, branch                   |
| `fix-bug`    | something behaves wrong: log, reproduce, root cause, test, fix, close                 |
| `ship-pr`    | the change is ready: commit, PR, CI, hand to review, after merge verify on production |
| `review-pr`  | automatic review of every PR you open (posted on the PR), or reviewing someone's PR   |
| `new-track`  | a mentor needs a new track: create the track repo, access, first review, publish      |
