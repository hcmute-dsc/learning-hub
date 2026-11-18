-- Registry source (DECISIONS ADR-10): the repo and commit each track was read from,
-- keyed by track slug, e.g. {"sql-30-days": {"repo": "...", "commitSha": "..."}}.
-- NULL for versions read from a single content repo or a local folder.
ALTER TABLE "content_versions" ADD COLUMN "track_sources" JSONB;
