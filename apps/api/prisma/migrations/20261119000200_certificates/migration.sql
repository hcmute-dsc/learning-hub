-- Track completion certificates (PRD F19, learning-hub#47). One per (user, track), issued
-- when the enrollment is first stored as completed. Name, track and content commit are
-- copied in so the certificate keeps saying what was true on the day it was issued.

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "track_slug" TEXT NOT NULL,
    "track_title" TEXT NOT NULL,
    "content_repo" TEXT NOT NULL,
    "commit_sha" CHAR(40) NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by" UUID,
    "revoke_reason" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_issued_at_idx" ON "certificates"("issued_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_user_id_track_id_key" ON "certificates"("user_id", "track_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rules the app also checks, kept in the database so no other writer can break them.
ALTER TABLE "certificates"
  -- the unguessable link code: 24 chars of lower-case base32 (120 random bits)
  ADD CONSTRAINT "certificates_code_chk" CHECK (code ~ '^[a-z2-7]{24}$'),
  ADD CONSTRAINT "certificates_commit_sha_chk" CHECK (commit_sha ~ '^[0-9a-f]{40}$'),
  ADD CONSTRAINT "certificates_revoke_reason_chk" CHECK (revoke_reason IS NULL OR char_length(revoke_reason) <= 280),
  -- revoked means: a time and a reason, always together
  ADD CONSTRAINT "certificates_revoked_chk" CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL));
