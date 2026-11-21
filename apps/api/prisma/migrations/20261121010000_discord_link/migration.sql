-- learning-hub#76: members link their Discord account (OAuth2 scope `identify`) so the
-- weekly leaderboard post can mention them. Linking is not consent to appear: only
-- users.leaderboard_opt_in is (ADR-08).
ALTER TABLE "users" ADD COLUMN "discord_user_id" TEXT,
ADD COLUMN "discord_username" TEXT;
CREATE UNIQUE INDEX "users_discord_user_id_key" ON "users"("discord_user_id");
-- Discord ids are snowflakes: digits only. Anything else could not be a mention.
ALTER TABLE "users" ADD CONSTRAINT "users_discord_user_id_check" CHECK ("discord_user_id" ~ '^[0-9]{15,21}$');

-- One post per week: the outbox refuses a second row with the same key.
ALTER TABLE "outbox_events" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
