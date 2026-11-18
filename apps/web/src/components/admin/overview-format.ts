/** Pure helpers for the admin overview page (tested in overview-format.test.ts). */

/** 0 → "dưới 1 giờ", 5 → "5 giờ", 50 → "2 ngày 2 giờ", 48 → "2 ngày". */
export function waitLabel(hours: number): string {
  if (hours < 1) return 'dưới 1 giờ';
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} ngày ${rest} giờ` : `${days} ngày`;
}

/** First 7 characters of a commit, like GitHub shows it. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
