import { TERM_ID_PATTERN } from '@hub/shared';

/**
 * Terms of the leaderboard (E14, ADR-08): the board resets each term and there is no
 * all-time board. Pure functions, tested in term.spec.ts.
 *
 * A school year Y–(Y+1) has three terms, in Vietnam time (always UTC+7, no DST):
 *   "Y-1"  Học kỳ 1    1 September Y   → 1 February Y+1
 *   "Y-2"  Học kỳ 2    1 February Y+1  → 1 July Y+1
 *   "Y-3"  Học kỳ hè   1 July Y+1      → 1 September Y+1
 * Ends are exclusive, so every moment is in exactly one term.
 */

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface Term {
  id: string;
  label: string;
  startsAt: Date;
  /** exclusive */
  endsAt: Date;
}

/** Start month (1-12) and whether it falls in the second calendar year of the school year. */
const TERM_STARTS: Record<1 | 2 | 3, { month: number; nextYear: boolean; label: string }> = {
  1: { month: 9, nextYear: false, label: 'Học kỳ 1' },
  2: { month: 2, nextYear: true, label: 'Học kỳ 2' },
  3: { month: 7, nextYear: true, label: 'Học kỳ hè' },
};

/** Midnight at the start of this Vietnam day, as a real moment. */
export function vietnamMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - VIETNAM_OFFSET_MS);
}

function startOf(year: number, part: 1 | 2 | 3): Date {
  const s = TERM_STARTS[part];
  return vietnamMidnight(s.nextYear ? year + 1 : year, s.month, 1);
}

function next(year: number, part: 1 | 2 | 3): [number, 1 | 2 | 3] {
  return part === 3 ? [year + 1, 1] : [year, (part + 1) as 2 | 3];
}

function previous(year: number, part: 1 | 2 | 3): [number, 1 | 2 | 3] {
  return part === 1 ? [year - 1, 3] : [year, (part - 1) as 1 | 2];
}

function build(year: number, part: 1 | 2 | 3): Term {
  const [ny, np] = next(year, part);
  return {
    id: `${year}-${part}`,
    label: `${TERM_STARTS[part].label}, ${year}–${year + 1}`,
    startsAt: startOf(year, part),
    endsAt: startOf(ny, np),
  };
}

function parse(id: string): [number, 1 | 2 | 3] | null {
  if (!TERM_ID_PATTERN.test(id)) return null;
  const [year, part] = id.split('-').map(Number);
  return [year, part as 1 | 2 | 3];
}

/** The term that contains this moment. */
export function termAt(at: Date): Term {
  const local = new Date(at.getTime() + VIETNAM_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth() + 1;
  if (month >= 9) return build(year, 1);
  if (month === 1) return build(year - 1, 1);
  if (month <= 6) return build(year - 1, 2);
  return build(year - 1, 3);
}

/** The term with this id, or null for a malformed id. */
export function termById(id: string): Term | null {
  const parsed = parse(id);
  return parsed ? build(...parsed) : null;
}

/** Id of the term before / after this one. */
export function previousTermId(id: string): string | null {
  const parsed = parse(id);
  return parsed ? previous(...parsed).join('-') : null;
}

export function nextTermId(id: string): string | null {
  const parsed = parse(id);
  return parsed ? next(...parsed).join('-') : null;
}

/**
 * The term a member asked for: the current one when none is given. Future terms do not
 * have a board yet, so they are refused like malformed ids (null).
 */
export function resolveTerm(id: string | undefined, now: Date): Term | null {
  const current = termAt(now);
  if (!id) return current;
  const term = termById(id);
  if (!term || term.startsAt > current.startsAt) return null;
  return term;
}
