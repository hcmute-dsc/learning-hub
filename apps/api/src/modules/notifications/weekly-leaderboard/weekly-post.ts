import type { LeaderboardRow } from '@hub/shared';
import { isoWeekId, type Week } from '../../leaderboard/week';
import { escapeDiscord } from '../messages';

/**
 * Weekly leaderboard post on the club Discord channel (learning-hub#76, ADR-08).
 * Pure functions, tested in weekly-post.spec.ts.
 *
 * Every Monday from 09:00 Vietnam time the top 5 of the week before (Monday 00:00 →
 * Monday 00:00) is posted once. Only opted-in members are in the rows (the leaderboard
 * query filters them); a linked Discord account only decides whether the member is
 * mentioned or shown by name.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Vietnam has no daylight saving time: always UTC+7. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Monday 09:00 in Vietnam. */
export const POST_HOUR = 9;
export const WEEKLY_TOP = 5;
/** Discord snowflake: anything else must never reach a mention or allowed_mentions. */
const SNOWFLAKE = /^[0-9]{15,21}$/;
/** Discord orange-ish brand color of the embed (DSC orange). */
const EMBED_COLOR = 0xf26b1d;

export type { Week };
export { isoWeekId };

/**
 * The week whose post is due at `now`: on Monday from 09:00 until the end of Monday
 * (Vietnam time), the week that just ended; any other time, none. A server that was
 * down at 09:00 still posts later that Monday, but never days late.
 */
export function dueWeek(now: Date): Week | null {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const weekday = (local.getUTCDay() + 6) % 7;
  if (weekday !== 0 || local.getUTCHours() < POST_HOUR) return null;
  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const endsAt = new Date(mondayLocal - VIETNAM_OFFSET_MS);
  const startsAt = new Date(endsAt.getTime() - 7 * DAY_MS);
  return { id: isoWeekId(startsAt), startsAt, endsAt };
}

/**
 * The full week (Monday 00:00 → Monday 00:00, Vietnam time) before the week that
 * contains `now`: what an admin posts or updates by hand (learning-hub#83). On Monday
 * from 09:00 it is the same week as dueWeek(now), so the job and the button share a key.
 */
export function previousWeek(now: Date): Week {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const weekday = (local.getUTCDay() + 6) % 7;
  const mondayLocal =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - weekday * DAY_MS;
  const endsAt = new Date(mondayLocal - VIETNAM_OFFSET_MS);
  const startsAt = new Date(endsAt.getTime() - 7 * DAY_MS);
  return { id: isoWeekId(startsAt), startsAt, endsAt };
}

/** Outbox idempotency key: one post per week, whatever reruns. */
export function weekKey(week: Pick<Week, 'id'>): string {
  return `leaderboard-week:${week.id}`;
}

export interface DiscordEmbed {
  title: string;
  url: string;
  description: string;
  color: number;
  footer: { text: string };
}

/** What the outbox row carries and the club channel posts. */
export interface WeeklyPost {
  weekId: string;
  content: string;
  embeds: DiscordEmbed[];
  /** the only accounts Discord may ping (allowed_mentions.users) */
  mentionUserIds: string[];
}

/**
 * Discord's allowed_mentions for the post: nobody by type (no @everyone, roles or stray
 * user ids), only the listed accounts. Invalid ids and duplicates are dropped; Discord
 * accepts at most 100.
 */
export function allowedMentions(ids: string[]): { parse: []; users: string[] } {
  return { parse: [], users: [...new Set(ids.filter((id) => SNOWFLAKE.test(id)))].slice(0, 100) };
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * The post for one week, or null when nobody is on the board (nothing is posted).
 * `rows` is the ranked board of the week (opted-in members only); the first WEEKLY_TOP
 * are shown. `discordIds` maps a member id to their linked Discord id.
 */
export function buildWeeklyPost(input: {
  week: Pick<Week, 'id'>;
  rows: LeaderboardRow[];
  discordIds: Map<string, string>;
  hubUrl: string;
}): WeeklyPost | null {
  const top = input.rows.slice(0, WEEKLY_TOP);
  if (!top.length) return null;

  const mentions: string[] = [];
  const lines = top.map((row) => {
    const discordId = input.discordIds.get(row.user.id);
    const linked = discordId !== undefined && SNOWFLAKE.test(discordId);
    if (linked) mentions.push(discordId);
    const who = linked ? `<@${discordId}>` : `**${escapeDiscord(row.user.displayName, 60)}**`;
    const place = MEDAL[row.rank] ?? `#${row.rank}`;
    return `${place} ${who} — ${row.score} điểm (${row.completed} bài)`;
  });

  const unique = allowedMentions(mentions).users;
  const content = unique.length
    ? `🎉 Chúc mừng ${unique.map((id) => `<@${id}>`).join(' ')} đã học chăm nhất tuần qua!`
    : '🎉 Những thành viên học chăm nhất tuần qua!';

  return {
    weekId: input.week.id,
    content,
    embeds: [
      {
        title: `🏆 Bảng xếp hạng tuần ${input.week.id}`,
        url: new URL('/leaderboard', input.hubUrl).toString(),
        description: lines.join('\n'),
        color: EMBED_COLOR,
        footer: {
          text: 'Chỉ gồm thành viên tự bật bảng xếp hạng trên Learning Hub. Tính theo số bài hoàn thành, không tính tốc độ.',
        },
      },
    ],
    mentionUserIds: unique,
  };
}
