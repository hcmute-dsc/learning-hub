-- Club member email list used to approve new accounts (decided 16/11/2026, SECURITY §1).
CREATE TABLE "approved_emails" (
    "email" TEXT NOT NULL,
    "note" TEXT,
    "added_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approved_emails_pkey" PRIMARY KEY ("email"),
    -- the app stores emails trimmed and lower-cased; enforce it so lookups stay exact
    CONSTRAINT "approved_emails_normalized_chk" CHECK ("email" = lower(btrim("email")))
);

ALTER TABLE "approved_emails" ADD CONSTRAINT "approved_emails_added_by_fkey"
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- users.email is matched against the list when it changes
CREATE INDEX "users_pending_email_idx" ON "users" ("email") WHERE "status" = 'pending';
