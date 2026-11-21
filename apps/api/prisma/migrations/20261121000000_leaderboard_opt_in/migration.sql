-- E14 (learning-hub#5, ADR-08): members choose to appear on the term leaderboard. Off by default,
-- so nobody shows up until they turn it on in /settings.
ALTER TABLE "users" ADD COLUMN "leaderboard_opt_in" BOOLEAN NOT NULL DEFAULT false;
