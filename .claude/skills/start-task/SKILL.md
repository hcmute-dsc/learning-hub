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

## 3. Fill in everything

**No empty box in the issue sidebar.** The maintainer checks the sidebar, and a half-filled issue is not done (learning-hub#10). One command fills it all:

```bash
bash .claude/skills/start-task/project-item.sh <issue-url> \
  Type=Task "Status=In progress" "Priority=P1 - Cao" Area=Backend Size=S "Epic=Vận hành" \
  Sprint=@current "Milestone=Phase 0 — Dùng thử" Assignee=@me Label=enhancement
```

Required for every issue:

| Field       | Values                                                                                                            | How to choose                                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `Type`      | `Bug`, `Feature`, `Task`                                                                                          | Bug = something wrong; Feature = new capability for users; Task = everything else (ops, docs, tests, refactor, club work) |
| `Label`     | `bug`, `enhancement`, `documentation`, `ops`, `club` (docs repo), `content` (content repo)                        | matches Type/Area. Labels are per repo: `gh label list --repo …`                                                          |
| `Status`    | `Backlog`, `Ready`, `In progress`, `In review`, `Done`                                                            | In progress when you start now                                                                                            |
| `Priority`  | `P0 - Gấp`, `P1 - Cao`, `P2 - Bình thường`                                                                        | also sets the org **Priority** (Urgent/High/Medium)                                                                       |
| `Area`      | `Backend`, `Frontend`, `Content`, `Ops`, `Docs`, `Club`                                                           | where the work happens                                                                                                    |
| `Size`      | `S` (≤ 1 session), `M` (a few), `L` (a sprint, split it)                                                          | also sets the org **Effort** (Low/Medium/High)                                                                            |
| `Epic`      | `E6 Chấm tự động`, `E8 Mentorship`, `E13 SQL checker`, `E14 Bảng xếp hạng`, `E15 Web Push`, `Phase 0`, `Vận hành` | ops, fixes and tooling go to `Vận hành`                                                                                   |
| `Milestone` | `Phase 0 — Dùng thử`, `MVP-Full` (learning-hub only)                                                              | MVP-Full = epics E6/E8/E13/E14/E15                                                                                        |
| `Assignee`  | `@me` or a login                                                                                                  | whoever does it now. Backlog items stay unassigned on purpose (free to take)                                              |
| `Sprint`    | `@current` or `Sprint 2`…                                                                                         | anything you start now. Also sets **Target date** to the sprint's last day (planned deadline)                             |

Optional:

- **Start date** is the day work really starts: `Status=In progress` sets it to today (kept if already set). **Target date** becomes the real finish day when you set `Status=Done`. Rules and tests: `item-dates.sh`, `item-dates.test.sh` (learning-hub#89).
- `Start=YYYY-MM-DD` and `Target=YYYY-MM-DD` override both. A closed issue gets its real start and close dates.
- **Relationships**: set them when they exist. A blocked task: `addBlockedBy` (GraphQL), or the sidebar → Relationships. Pieces of a big task: sub-issues.
- **Development**: PRs link themselves through `Closes #n`. A PR in another repo can only `Refs`, so comment its link on the issue.

The script needs `gh` with the `project` scope. If it fails with `missing required scopes`, ask the user to run `gh auth refresh -h github.com -s project`. If GitHub answers `API rate limit exceeded` (a per-minute limit), wait a few minutes before running it again; don't loop.

## 4. Branch

```bash
git switch main && git pull --ff-only
git switch -c <type>/<issue>-<short-slug>      # fix/8-track-source-commit
```

- `type` is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- If the issue is in another repo, prefix the repo: `chore/docs-4-work-standards`.

Tell the user the issue link and branch name in one line, then do the work. When it is ready, use `ship-pr`.
