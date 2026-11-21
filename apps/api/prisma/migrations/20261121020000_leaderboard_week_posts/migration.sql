-- learning-hub#83: remember the Discord message of each weekly leaderboard post, so an admin
-- can edit it (PATCH the webhook message) instead of posting a second one.
CREATE TABLE "leaderboard_week_posts" (
    "week_id" TEXT NOT NULL,
    "discord_message_id" TEXT NOT NULL,
    "posted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leaderboard_week_posts_pkey" PRIMARY KEY ("week_id"),
    CONSTRAINT "leaderboard_week_posts_week_id_check" CHECK ("week_id" ~ '^[0-9]{4}-W[0-9]{2}$'),
    CONSTRAINT "leaderboard_week_posts_message_id_check" CHECK ("discord_message_id" ~ '^[0-9]{15,21}$')
);
