-- Constraints Prisma cannot express in schema.prisma (DATABASE.md §3–§5).
-- Enum-like text columns use CHECK so adding a value is a simple migration.

ALTER TABLE users ADD CONSTRAINT users_status_chk CHECK (status IN ('pending', 'active', 'suspended'));
CREATE UNIQUE INDEX users_email_uq ON users (email) WHERE email IS NOT NULL;

ALTER TABLE content_versions
  ADD CONSTRAINT content_versions_status_chk CHECK (status IN ('draft', 'published', 'superseded', 'rejected')),
  ADD CONSTRAINT content_versions_sha_chk CHECK (commit_sha ~ '^[0-9a-f]{40}$');
-- Only one published content version at a time.
CREATE UNIQUE INDEX content_versions_one_published_uq ON content_versions ((true)) WHERE status = 'published';

ALTER TABLE tracks
  ADD CONSTRAINT tracks_level_chk CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  ADD CONSTRAINT tracks_status_chk CHECK (status IN ('active', 'archived'));
CREATE INDEX tracks_tags_gin ON tracks USING GIN (tags);

ALTER TABLE modules ADD CONSTRAINT modules_status_chk CHECK (status IN ('active', 'archived'));
ALTER TABLE lessons ADD CONSTRAINT lessons_status_chk CHECK (status IN ('active', 'archived'));

ALTER TABLE exercises
  ADD CONSTRAINT exercises_type_chk CHECK (type IN ('code', 'quiz', 'project', 'self_check')),
  ADD CONSTRAINT exercises_difficulty_chk CHECK (difficulty IN ('easy', 'medium', 'hard')),
  ADD CONSTRAINT exercises_status_chk CHECK (status IN ('active', 'archived'));

ALTER TABLE exercise_prerequisites
  ADD CONSTRAINT exercise_prerequisites_self_chk CHECK (exercise_id <> required_exercise_id);

ALTER TABLE enrollments ADD CONSTRAINT enrollments_status_chk CHECK (status IN ('active', 'completed', 'dropped'));
ALTER TABLE lesson_progress ADD CONSTRAINT lesson_progress_status_chk CHECK (status IN ('in_progress', 'completed'));

ALTER TABLE submissions
  ADD CONSTRAINT submissions_source_type_chk CHECK (source_type IN ('github_pr', 'github_commit', 'quiz_answers', 'self_check', 'link')),
  ADD CONSTRAINT submissions_status_chk CHECK (status IN ('submitted', 'testing', 'passed', 'failed', 'awaiting_review', 'approved', 'changes_requested', 'errored')),
  ADD CONSTRAINT submissions_attempt_chk CHECK (attempt >= 1),
  ADD CONSTRAINT submissions_head_sha_chk CHECK (head_sha IS NULL OR head_sha ~ '^[0-9a-f]{40}$');
CREATE UNIQUE INDEX submissions_idempotency_uq ON submissions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX submissions_review_queue_idx ON submissions (submitted_at) WHERE status = 'awaiting_review';

ALTER TABLE test_runs
  ADD CONSTRAINT test_runs_provider_chk CHECK (provider IN ('github_checker', 'internal_quiz')),
  ADD CONSTRAINT test_runs_status_chk CHECK (status IN ('queued', 'running', 'passed', 'failed', 'errored'));

ALTER TABLE reviews ADD CONSTRAINT reviews_status_chk CHECK (status IN ('in_progress', 'approved', 'changes_requested'));
-- At most one open review per submission.
CREATE UNIQUE INDEX reviews_one_open_uq ON reviews (submission_id) WHERE status = 'in_progress';

ALTER TABLE mentor_assignments
  ADD CONSTRAINT mentor_assignments_status_chk CHECK (status IN ('requested', 'active', 'declined', 'ended')),
  ADD CONSTRAINT mentor_assignments_not_self_chk CHECK (mentor_id IS NULL OR mentor_id <> mentee_id);
-- One open request/assignment per mentee and track (NULL track = club-wide).
CREATE UNIQUE INDEX mentor_assignments_one_open_uq
  ON mentor_assignments (mentee_id, COALESCE(track_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('requested', 'active');

ALTER TABLE outbox_events ADD CONSTRAINT outbox_events_status_chk CHECK (status IN ('pending', 'sent', 'failed'));

CREATE INDEX audit_logs_created_brin ON audit_logs USING BRIN (created_at);
