-- Badges and streak (F12, 18/11/2026). The badge list and rules are code; this table only
-- remembers which member earned which badge and when. The primary key makes awarding
-- idempotent: a second insert of the same (user, badge) is skipped.
ALTER TABLE "users" ADD COLUMN "show_achievements" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge" TEXT NOT NULL,
    "awarded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge")
);

ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Codes are snake_case identifiers (packages/shared achievements.ts). No list of allowed
-- codes here, so adding a badge needs no migration.
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_format" CHECK ("badge" ~ '^[a-z0-9_]{1,40}$');
