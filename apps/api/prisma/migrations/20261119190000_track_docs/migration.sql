-- Track pages "Cài đặt" and "Tài liệu thêm" (CONTENT-SPECIFICATION §3.1b, learning-hub#44).
-- tracks.setup_md: docs/setup.md of the track (install the tools, check your work locally).
-- tracks.resources_md: docs/resources.md of the track (extra reading).
-- Both are optional, so NULL means the track has no such page. Written by CatalogWriter on publish,
-- like every other catalog column, so they follow the published content version.

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "resources_md" TEXT,
ADD COLUMN     "setup_md" TEXT;
