-- learning-hub#41: after a finished review, the member and the mentor talk on it, and the
-- member can thank the mentor. Messages reuse review_comments (file/line columns stay NULL);
-- thank-you notes get their own table, one per review, private until the mentor shows it.

-- CreateTable
CREATE TABLE "review_thanks" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "mentee_id" UUID NOT NULL,
    "mentor_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_thanks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_thanks_review_id_key" ON "review_thanks"("review_id");

-- CreateIndex
CREATE INDEX "review_thanks_mentor_id_is_public_created_at_idx" ON "review_thanks"("mentor_id", "is_public", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "review_thanks" ADD CONSTRAINT "review_thanks_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_thanks" ADD CONSTRAINT "review_thanks_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_thanks" ADD CONSTRAINT "review_thanks_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Thread messages: 1–2000 characters (the API trims and checks too).
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_body_len_chk"
    CHECK (char_length("body_md") BETWEEN 1 AND 2000);

ALTER TABLE "review_thanks" ADD CONSTRAINT "review_thanks_body_len_chk"
    CHECK (char_length("body") BETWEEN 1 AND 280);

-- New bell types: a reply on a review, a thank-you to the mentor.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_chk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_chk"
    CHECK ("type" IN ('review_completed', 'review_requested', 'track_published',
                      'review_message', 'review_thanks'));
