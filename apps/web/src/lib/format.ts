const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

/** ISO timestamp → "16/11/2026, 14:05" in Vietnam time, the same on server and browser. */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** 0–1 score → "80%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
