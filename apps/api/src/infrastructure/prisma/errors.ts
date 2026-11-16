/**
 * True when Prisma reported a unique violation (P2002). With `field`, only when the
 * violated unique key mentions that column, e.g. 'attempt' for
 * (user_id, exercise_id, attempt). Duck-typed on `code`/`meta` so it can be tested
 * without a database and works for every Prisma error class.
 */
export function isUniqueViolation(err: unknown, field?: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ((err as { code?: unknown }).code !== 'P2002') return false;
  if (field === undefined) return true;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return text.includes(field);
}
