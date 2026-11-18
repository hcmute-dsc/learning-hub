---
name: new-track
description: Set up a new Learning Hub track for a mentor, the club board's side — answer the proposal issue, create hcmute-dsc/learning-hub-track-<slug> from the template, labels, milestone, mentor access, review the first PR, pin the commit in learning-hub-content tracks.yaml, sync and publish. Use when the user wants a new track (C#, Java…), a repo for a mentor, or to put a new track on the site. The mentor's side (init, write, PR) is the new-track skill in the track repo.
---

# New track (club board side)

Guide for people: learning-hub-docs `docs/ops/NEW-TRACK.md`. Decision: DECISIONS ADR-10 (one repo per track, learning-hub-content is the registry).

Creating a repo, inviting a person and publishing are outward actions. **Ask the user in chat before each one**, and show the exact slug, repo name and GitHub account first.

## 1. The proposal

The mentor opens "Đề xuất" in learning-hub-content. If the user asks for a track without one, open it (`start-task`), with every field filled:

```bash
bash .claude/skills/start-task/project-item.sh <issue-url> Type=Feature Label=enhancement "Status=In progress" \
  "Priority=P2 - Bình thường" Area=Content Size=M "Epic=Phase 0" Sprint=@current "Milestone=Phase 0 — Dùng thử" Assignee=@me
```

Check the slug: kebab-case, short, not already in `tracks.yaml` nor an existing repo (`gh repo view hcmute-dsc/learning-hub-track-<slug>` must fail). It becomes the URL `/tracks/<slug>` and never changes after publishing.

## 2. Create the repo (after the user's yes)

```bash
R=hcmute-dsc/learning-hub-track-<slug>
gh repo create $R --public --template hcmute-dsc/learning-hub-track-template \
  --description "Track <slug> của DSC Learning Hub: <Tên track> (ADR-10)"
gh repo edit $R --enable-wiki=false
gh label create content -R $R --color 1D76DB --description "Nội dung bài học, bài tập" --force
gh label create ops -R $R --color 0E8A16 --description "Vận hành: CI/CD, GitHub Actions, hạ tầng" --force
gh api repos/$R/milestones -f title="Phase 0 — Dùng thử"
gh api -X PUT repos/$R/collaborators/<mentor> -f permission=maintain   # invites the mentor
```

- Public, always: the registry CI downloads tracks through public links.
- Don't turn on branch protection or change org settings (WORKFLOW §7.5 needs the board's yes).
- add-to-project reads `PROJECT_APP_CLIENT_ID` / `PROJECT_APP_PRIVATE_KEY` from the **org** (public repos, learning-hub-docs#14), so a new public repo needs nothing. Don't create repo-level copies: they would override the org values. Never ask anyone to paste the key into chat.

Reply on the proposal issue with the repo link and NEW-TRACK.md §3.

## 3. First PR from the mentor

Review it with `review-pr` (content section) and post the review. Check in particular:

- `node tools/init-track.mjs` was run: no `example-track`, no placeholder uid `00000000-…`, maintainer and `CODEOWNERS` are the mentor;
- CI `validate` green; exactly one folder `tracks/<slug>/`;
- the example lessons and exercises that aren't used are deleted, and removed from `module.yaml`.

The user (or the mentor, who has Maintain) squash merges.

## 4. Publish (after the user's yes)

Follow the `publish-content` skill in learning-hub-content (step 0 pins the commit):

```bash
git ls-remote https://github.com/hcmute-dsc/learning-hub-track-<slug> main
```

Add the entry to `tracks.yaml` in a PR titled `<slug>: publish <short sha>`, wait for `validate`, get the user's review, merge. Then sync in Quản trị → Nội dung: a new track shows only **Thêm** (added). Publish, and check that the footer of `/tracks/<slug>` says `hcmute-dsc/learning-hub-track-<slug> @ <sha>`.

## 5. Close

Close the proposal issue with links (repo, publish PR, track page) and set it Done.
