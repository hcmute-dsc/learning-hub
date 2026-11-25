-- Mentors in charge of a track (learning-hub#120): an admin assigns them on /admin/mentors,
-- the track page shows them to members. DATABASE.md §3.15b. Rows are never deleted:
-- removing a mentor sets ended_at/ended_by, so who looked after a track stays on record.

-- CreateTable
CREATE TABLE "track_mentors" (
    "id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "assigned_by" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "ended_by" UUID,

    CONSTRAINT "track_mentors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "track_mentors_mentor_id_idx" ON "track_mentors"("mentor_id");

-- AddForeignKey
ALTER TABLE "track_mentors" ADD CONSTRAINT "track_mentors_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_mentors" ADD CONSTRAINT "track_mentors_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_mentors" ADD CONSTRAINT "track_mentors_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_mentors" ADD CONSTRAINT "track_mentors_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An end date is never before the start; ended_at and ended_by are set together.
ALTER TABLE "track_mentors"
  ADD CONSTRAINT "track_mentors_dates_chk" CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at");

-- One open assignment per track and mentor; two admins clicking at once get a conflict.
CREATE UNIQUE INDEX "track_mentors_one_open_uq" ON "track_mentors" ("track_id", "mentor_id")
  WHERE "ended_at" IS NULL;
