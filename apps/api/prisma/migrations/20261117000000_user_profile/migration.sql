-- Member profile and personal settings (17/11/2026): a short bio and the color scheme.
ALTER TABLE "users" ADD COLUMN "bio" TEXT;
ALTER TABLE "users" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system';

ALTER TABLE "users" ADD CONSTRAINT "users_bio_length" CHECK (char_length("bio") <= 280);
ALTER TABLE "users" ADD CONSTRAINT "users_theme_check" CHECK ("theme" IN ('system', 'light', 'dark'));
