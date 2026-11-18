import { GITHUB_LOGIN_PATTERN, TRACK_SLUG_PATTERN } from '@hub/shared';

/**
 * Review queue filters in the URL (`/review?track=&mentee=`), tested in
 * queue-filter.test.ts. Same rules as the API's query schema, so a hand-edited URL
 * shows the whole queue instead of an error page.
 */

export interface QueueFilter {
  track: string | null;
  mentee: string | null;
}

type SearchValue = string | string[] | undefined;

/** One value from Next's searchParams: the first if repeated, null if missing or invalid. */
function pick(value: SearchValue, pattern: RegExp, max: number): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length <= max && pattern.test(trimmed) ? trimmed : null;
}

export function parseQueueFilter(params: {
  track?: SearchValue;
  mentee?: SearchValue;
}): QueueFilter {
  return {
    track: pick(params.track, TRACK_SLUG_PATTERN, 80),
    mentee: pick(params.mentee, GITHUB_LOGIN_PATTERN, 39),
  };
}

/** `?track=…&mentee=…` for the API call or a link; '' when nothing is filtered. */
export function queueQuery(filter: QueueFilter): string {
  const params = new URLSearchParams();
  if (filter.track) params.set('track', filter.track);
  if (filter.mentee) params.set('mentee', filter.mentee);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function isFiltered(filter: QueueFilter): boolean {
  return filter.track !== null || filter.mentee !== null;
}
