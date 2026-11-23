---
name: review-pr
description: Review a Learning Hub pull request with the team checklist (correctness, security, design rules, tests, readability, docs), fix or report must/nit items, and post the result on the PR. Runs automatically on every PR an agent opens, before the hand-off (ship-pr §4), and when asked to review someone's PR in learning-hub, learning-hub-content, learning-hub-docs or a learning-hub-track-* repo.
---

# Review a PR

```bash
gh pr view <n> --repo hcmute-dsc/<repo>
gh pr diff <n> --repo hcmute-dsc/<repo>
gh pr checks <n> --repo hcmute-dsc/<repo>
```

Read the linked issue first, then the diff. Then read the code around the change, not just the hunks:

- **Check every assumption the change relies on** in the code that provides it (who writes this row, when, inside which transaction; can this be null; is there only one row with this status). Write down where you checked.
- Look for the **same bug elsewhere**: other callers, sibling pages or endpoints with the same pattern.
- Think through rollbacks, retries and the "before the first run" case.

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
- the Vietnamese is clear and simple;
- it meets the **teaching standard** in the track's `TEACHING.md` ([template](https://github.com/hcmute-dsc/learning-hub-track-template/blob/main/TEACHING.md), from Study Jam learner feedback). For each criterion that fails, write a `must:`:
  - **T1 Vocabulary:** every new English command, flag or term has its full form and literal meaning, and its new words are in the track's `glossary.yaml` and the lesson's `terms:` (the hub builds the "Từ mới trong bài" box from them; a hand-written box is a `nit:`).
  - **T2 Explain before practice:** do the exercise using only its lesson and earlier ones. Anything you had to look up is missing. Every command block has "Đọc hiểu".
  - **T3 Mental model:** anything with states, or easy to confuse, has a diagram or comparison table.
  - **T4 Real-world:** each chapter has a "Ngoài thực tế" section.
  - **T5 Setup:** anything installed or configured is in `docs/setup.md`, and commands work in Windows PowerShell as well as on macOS/Linux (`curl.exe`, `python`/`python3`, `$env:`).
  - **T6 Asking:** the error table points to the mentor, including a private DM, and `docs/setup.md` has "Hỏi ở đâu" with a real mentor handle.

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

## Automatic review of your own PR (learning-hub#22)

Every PR an agent opens gets this review **before** it is handed to the maintainer, so they read a checked summary instead of starting from zero.

1. Run the checklist above on the final diff, after CI is green.
2. Fix every `must:` on the branch, push, wait for CI again, and review the new diff.
3. Post the result as a PR comment (GitHub doesn't allow approving your own PR):

   ```bash
   gh pr review <n> --repo hcmute-dsc/<repo> --comment --body-file review.md
   ```

4. Give the review link in the hand-off message, with the `nit:` items you chose to leave.

`review.md` template (Vietnamese, plain and short):

```markdown
## Review tự động (skill `review-pr`)

**Kết luận:** không còn `must:`, có thể merge. (hoặc: còn N `must:`, chưa nên merge)

### Đã kiểm tra

1. **Đúng chức năng:** … (giả định nào, kiểm ở file nào)
2. **Trường hợp biên:** …
3. **Bảo mật:** …
4. **Thiết kế:** …
5. **Test:** … CI `<job>` xanh.
6. **Tài liệu:** …

### Góp ý

- `must:` / `nit:` / `question:` … (`file:line`, vì sao, cách sửa)
```

Never write secrets, the VPS IP, webhook URLs or member emails in the review: the repos are public.
