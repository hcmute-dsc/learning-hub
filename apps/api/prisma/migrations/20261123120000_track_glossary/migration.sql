-- Track glossary (CONTENT-SPECIFICATION §3.1c, learning-hub#106).
-- tracks.glossary: glossary.yaml of the track as a JSON array of
--   { term, anchor, expansion, literal, meaning, example, see }, in file order.
--   NULL means the track has no glossary.
-- lessons.terms: the `terms:` front matter of the lesson, the words it introduces.
-- Both are written by CatalogWriter on publish, like every other catalog column, so they
-- follow the published content version.

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "glossary" JSONB;

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "terms" TEXT[] DEFAULT ARRAY[]::TEXT[];
