-- "Báo lỗi nội dung" (learning-hub#121): members report mistakes in lessons, exercises and
-- track pages; admins and mentors handle them on /admin/content-reports. DATABASE.md §3.
-- Enum-like columns are text + CHECK, like the rest of the schema.

-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "track_id" UUID NOT NULL,
    "target_kind" TEXT NOT NULL,
    "target_ref" TEXT NOT NULL,
    "target_title" TEXT NOT NULL,
    "commit_sha" CHAR(40),
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "handled_by" UUID,
    "staff_note" TEXT,
    "github_issue_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_reports_track_id_status_created_at_idx" ON "content_reports"("track_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "content_reports_reporter_id_created_at_idx" ON "content_reports"("reporter_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_handled_by_fkey" FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "content_reports"
    ADD CONSTRAINT "content_reports_target_kind_chk"
        CHECK ("target_kind" IN ('lesson', 'exercise', 'track_page', 'glossary')),
    ADD CONSTRAINT "content_reports_category_chk"
        CHECK ("category" IN ('typo', 'wrong_knowledge', 'broken_code', 'wrong_answer',
                              'broken_media', 'other')),
    ADD CONSTRAINT "content_reports_status_chk"
        CHECK ("status" IN ('open', 'in_progress', 'resolved', 'dismissed')),
    ADD CONSTRAINT "content_reports_description_len_chk"
        CHECK (char_length("description") BETWEEN 1 AND 2000),
    ADD CONSTRAINT "content_reports_quote_len_chk"
        CHECK ("quote" IS NULL OR char_length("quote") BETWEEN 1 AND 500),
    ADD CONSTRAINT "content_reports_staff_note_len_chk"
        CHECK ("staff_note" IS NULL OR char_length("staff_note") BETWEEN 1 AND 2000),
    -- closed_at is set exactly while the report is resolved or dismissed
    ADD CONSTRAINT "content_reports_closed_at_chk"
        CHECK (("status" IN ('resolved', 'dismissed')) = ("closed_at" IS NOT NULL));

-- New bell type: a report the member sent was resolved or dismissed.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_chk";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_chk"
    CHECK ("type" IN ('review_completed', 'review_requested', 'track_published',
                      'review_message', 'review_thanks', 'content_report'));
