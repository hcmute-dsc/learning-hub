import { DISPLAY_NAME_MAX, type Leaderboard, type LeaderboardRow } from '@hub/shared';
import { splitPodium, type ShareSize } from './board';

/** What the share image shows (tested in board.test.ts / share-card.test.ts). */
export interface ShareCardData {
  size: ShareSize;
  title: string;
  /** "Học kỳ 1, 2026–2027" or "Tuần 47 (16/11 – 22/11/2026)" */
  period: string;
  /** track title, or null for every track */
  track: string | null;
  podium: LeaderboardRow[];
  rest: LeaderboardRow[];
  empty: boolean;
  footer: string;
}

/** How many list rows (after the podium) fit on each size. */
export const LIST_ROWS: Record<ShareSize, number> = { square: 7, wide: 4 };

/**
 * The card for one board. Only the top of the board (opted-in members only, ADR-08):
 * never the viewer's own row, so the image is the same whoever saves it.
 */
export function shareCardData(board: Leaderboard, size: ShareSize, host: string): ShareCardData {
  const { podium, rest } = splitPodium(board.top);
  return {
    size,
    title: board.range.period === 'week' ? 'Bảng xếp hạng tuần' : 'Bảng xếp hạng học kỳ',
    period: board.range.label,
    track: board.track?.title ?? null,
    podium,
    rest: rest.slice(0, LIST_ROWS[size]),
    empty: board.top.length === 0,
    footer: `${host} · Chỉ có thành viên tự bật · Tính theo bài hoàn thành, không tính tốc độ`,
  };
}

/** GitHub avatars as a small square, so the image fetches less. */
export function avatarSmall(url: string, px: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'avatars.githubusercontent.com') u.searchParams.set('s', String(px));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * A member's name on the image: always the whole name (learning-hub#92), on one line of
 * text that the card wraps when it is long. Only spaces are tidied; the profile already
 * caps names at DISPLAY_NAME_MAX, and this cap only guards the layout from bad data.
 */
export function cardName(name: string): string {
  const tidy = name.replace(/\s+/g, ' ').trim();
  return tidy.length > DISPLAY_NAME_MAX ? `${tidy.slice(0, DISPLAY_NAME_MAX - 1)}…` : tidy;
}
