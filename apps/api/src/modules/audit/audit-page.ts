/**
 * Pure helpers for GET /admin/audit (tested in audit-page.spec.ts).
 *
 * The cursor is the id of the last row shown: audit ids come from a sequence, so
 * "id < cursor" is exactly "older than what you saw", even when rows share a timestamp.
 */

/** Rows were fetched with `limit + 1`; the extra one only says whether a next page exists. */
export function toPage<T extends { id: bigint }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  return { items, nextCursor: hasMore ? items[items.length - 1].id.toString() : null };
}

/**
 * Metadata as stored, minus anything that looks like an email field. Listeners only
 * write counts (SECURITY §1), so this is a safety net for a future listener mistake.
 */
export function safeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/email/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}
