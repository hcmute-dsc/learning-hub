import { glossaryAnchor, layout } from '@hub/content';
import type { GlossaryTerm, ItemRef, TrackGlossaryView } from '@hub/shared';

/**
 * Track glossary (CONTENT-SPECIFICATION §3.1c, learning-hub#106): pure mappers from
 * `tracks.glossary` and `lessons.terms` to the "Từ vựng" page and the lesson's new words.
 * Tested in glossary-views.spec.ts.
 */

/** One element of `tracks.glossary`, as CatalogWriter stores a parsed GlossaryEntry. */
interface StoredGlossaryEntry extends GlossaryTerm {
  see: string[];
}

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * `tracks.glossary` as a list. The column is JSON, so an element without a term or meaning
 * is skipped instead of breaking the page; publish only ever writes valid entries.
 */
export function storedGlossary(json: unknown): StoredGlossaryEntry[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw: Record<string, unknown> | null) => {
    const term = text(raw?.term);
    const meaning = text(raw?.meaning);
    if (!raw || !term || !meaning) return [];
    return [
      {
        term,
        anchor: text(raw.anchor) ?? glossaryAnchor(term),
        expansion: text(raw.expansion),
        literal: text(raw.literal),
        meaning,
        example: text(raw.example),
        see: Array.isArray(raw.see)
          ? raw.see.filter((s): s is string => typeof s === 'string')
          : [],
      },
    ];
  });
}

const toTerm = ({ see: _see, ...term }: StoredGlossaryEntry): GlossaryTerm => term;

/**
 * The glossary entries a lesson introduces, in the order of its `terms:`. Terms are matched
 * like the validator does (by anchor, so case does not matter); a term missing from the
 * glossary is left out.
 */
export function lessonTerms(glossary: unknown, terms: string[]): GlossaryTerm[] {
  const byAnchor = new Map(storedGlossary(glossary).map((e) => [e.anchor, e]));
  return terms.flatMap((term) => {
    const entry = byAnchor.get(glossaryAnchor(term));
    return entry ? [toTerm(entry)] : [];
  });
}

export interface GlossaryTrackRow {
  slug: string;
  title: string;
  glossary: unknown;
  sourcePath: string;
  /** active modules and their active lessons, in reading order */
  modules: { lessons: { id: string; title: string; terms: string[] }[] }[];
}

/**
 * The "Từ vựng" page, or null when the track has no glossary. Each term lists the lessons
 * that introduce it ("Học ở bài …") and its `see:` terms with their anchors. `source` is the
 * repo and commit members read now (`sourceFor` of the published version, like `toTrackDoc`).
 */
export function toTrackGlossary(
  track: GlossaryTrackRow,
  source: { repo: string; commitSha: string },
): TrackGlossaryView | null {
  const entries = storedGlossary(track.glossary);
  if (entries.length === 0) return null;

  const byAnchor = new Map(entries.map((e) => [e.anchor, e]));
  const lessonsOf = new Map<string, ItemRef[]>();
  for (const m of track.modules)
    for (const lesson of m.lessons)
      for (const anchor of new Set(lesson.terms.map(glossaryAnchor))) {
        if (!byAnchor.has(anchor)) continue;
        lessonsOf.set(anchor, [
          ...(lessonsOf.get(anchor) ?? []),
          { id: lesson.id, title: lesson.title },
        ]);
      }

  const trackDir = track.sourcePath.slice(0, track.sourcePath.lastIndexOf('/'));
  return {
    track: { slug: track.slug, title: track.title },
    terms: entries.map((entry) => ({
      ...toTerm(entry),
      see: entry.see.flatMap((ref) => {
        const target = byAnchor.get(glossaryAnchor(ref));
        return target ? [{ term: target.term, anchor: target.anchor }] : [];
      }),
      lessons: lessonsOf.get(entry.anchor) ?? [],
    })),
    source: { ...source, path: layout.glossaryFile(trackDir) },
  };
}
