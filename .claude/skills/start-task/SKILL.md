---
name: start-task
description: Start any Learning Hub request the standard way — find or create the GitHub issue, put it on org Project #1 with its fields, assign, move to In progress, and create the branch. Use at the start of every feature, bug, chore or docs request in learning-hub, learning-hub-content or learning-hub-docs, before editing files.
---

# Start a task

The rule: **no issue, no work**. The process is in learning-hub-docs `docs/ops/WORKFLOW.md` §2 and §7.

## 1. Pick the repo

| The change is in                   | Issue goes to                     |
| ---------------------------------- | --------------------------------- |
| API, web app, deploy, CI           | `hcmute-dsc/learning-hub`         |
| lessons, exercises, tracks         | `hcmute-dsc/learning-hub-content` |
| design docs, ops guides, club work | `hcmute-dsc/learning-hub-docs`    |

Work that spans repos gets one issue, in the repo where most of the work happens. The PRs in the other repos `Refs` it.

## 2. Find or create the issue

```bash
gh issue list --repo hcmute-dsc/<repo> --state all --search "<keywords>"
```

If none fits, create one that follows the repo's template (`.github/ISSUE_TEMPLATE/`). Write the body to a file and pass `--body-file`.

- Title prefix: `[Bug]`, `[Content]`, `[Ops]`, `[Org]`, `[E13]` (epic), `[Phase 0]`.
- Body:
  - context, with links to the docs;
  - a checklist of what to do;
  - **"Hoàn thành khi: …"** (done when).
- Bugs: use the `fix-bug` skill instead.
- Label: `bug`, `enhancement` or `documentation`.
- The repo is public. No secrets, VPS IP, webhook URLs or member emails.

```bash
gh issue create --repo hcmute-dsc/<repo> --title "[Ops] …" --label enhancement --body-file issue.md
```

## 3. Put it on the board

```bash
bash .claude/skills/start-task/project-item.sh <issue-url> \
  "Status=In progress" "Priority=P1 - Cao" Area=Backend Size=S "Epic=Vận hành"
gh issue edit <issue-url> --add-assignee @me
```

Fields and options:

- Priority: `P0 - Gấp`, `P1 - Cao`, `P2 - Bình thường`.
- Area: `Backend`, `Frontend`, `Content`, `Ops`, `Docs`, `Club`.
- Size: `S`, `M`, `L`.
- Epic: `E6 Chấm tự động`, `E8 Mentorship`, `E13 SQL checker`, `E14 Bảng xếp hạng`, `E15 Web Push`, `Phase 0`, `Vận hành`.
- Status: `Backlog`, `Ready`, `In progress`, `In review`, `Done`.

The script needs `gh` with the `project` scope. If it fails with `missing required scopes`, ask the user to run `gh auth refresh -h github.com -s project`.

## 4. Branch

```bash
git switch main && git pull --ff-only
git switch -c <type>/<issue>-<short-slug>      # fix/8-track-source-commit
```

- `type` is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- If the issue is in another repo, prefix the repo: `chore/docs-4-work-standards`.

Tell the user the issue link and branch name in one line, then do the work. When it is ready, use `ship-pr`.
