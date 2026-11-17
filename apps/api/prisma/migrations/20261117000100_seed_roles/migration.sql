-- The four fixed roles (DATABASE §3.2). Production runs only `prisma migrate deploy`
-- (no seed script), so the rows the app needs to boot live in a migration.
-- prisma/seed.ts upserts the same rows for development; keep both in sync.
INSERT INTO "roles" ("id", "code", "description") VALUES
  (1, 'member', 'Thành viên: học, nộp bài'),
  (2, 'mentor', 'Mentor: review bài, nhận mentee'),
  (3, 'content_maintainer', 'Duy trì nội dung, yêu cầu sync'),
  (4, 'admin', 'Ban chủ nhiệm / quản trị')
ON CONFLICT ("id") DO NOTHING;
