-- In-app notifications and the optional email digest (learning-hub#49, PRD F13, DATABASE §3.17).

-- One row per recipient. The outbox worker writes them; (source_event_id, user_id) is unique
-- so a retried fan-out does not create duplicates.
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source_event_id" BIGINT,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_source_event_id_user_id_key" ON "notifications"("source_event_id", "user_id");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at" DESC);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_chk"
    CHECK ("type" IN ('review_completed', 'review_requested', 'track_published'));

-- Email digest choice. No row = off, the default (PRD F13: opt-in).
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "email_digest" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribe_token" TEXT NOT NULL,
    "last_digest_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "notification_preferences_unsubscribe_token_key" ON "notification_preferences"("unsubscribe_token");
-- The digest scheduler only looks at members who turned it on.
CREATE INDEX "notification_preferences_digest_due_idx" ON "notification_preferences"("last_digest_at") WHERE "email_digest";

ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
