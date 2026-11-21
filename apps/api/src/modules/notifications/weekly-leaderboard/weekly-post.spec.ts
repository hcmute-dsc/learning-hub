import type { LeaderboardRow } from '@hub/shared';
import { allowedMentions, buildWeeklyPost, dueWeek, isoWeekId, weekKey } from './weekly-post';

const A = '111111111111111111';
const B = '222222222222222222';

const row = (id: string, rank: number, score: number, displayName = id): LeaderboardRow => ({
  rank,
  score,
  completed: score,
  user: { id, githubLogin: id, displayName, avatarUrl: null },
});

describe('weekly leaderboard: week math', () => {
  it('names ISO weeks, including the ones that cross a year', () => {
    expect(isoWeekId(new Date('2026-11-18T05:00:00Z'))).toBe('2026-W47');
    // Thursday 1 Jan 2026 → week 1 of 2026; Monday 29 Dec 2025 is in it too
    expect(isoWeekId(new Date('2025-12-29T05:00:00Z'))).toBe('2026-W01');
    // Friday 1 Jan 2027 belongs to the last week of 2026 (2026 has 53 weeks)
    expect(isoWeekId(new Date('2027-01-01T05:00:00Z'))).toBe('2026-W53');
  });

  it('uses the Vietnam day: Sunday 23:30 in Vietnam is still the old week', () => {
    // Sunday 22 Nov 2026 23:30 (UTC+7) = 16:30 UTC; Monday 00:10 = Sunday 17:10 UTC
    expect(isoWeekId(new Date('2026-11-22T16:30:00Z'))).toBe('2026-W47');
    expect(isoWeekId(new Date('2026-11-22T17:10:00Z'))).toBe('2026-W48');
  });

  it('is due on Monday from 09:00 Vietnam time, for the week that just ended', () => {
    // Monday 23 Nov 2026 09:00 in Vietnam = 02:00 UTC
    const week = dueWeek(new Date('2026-11-23T02:00:00Z'));
    expect(week).toEqual({
      id: '2026-W47',
      startsAt: new Date('2026-11-15T17:00:00Z'), // Monday 16 Nov 00:00 in Vietnam
      endsAt: new Date('2026-11-22T17:00:00Z'), // Monday 23 Nov 00:00 in Vietnam
    });
    // still due later that Monday (server was down at 09:00)
    expect(dueWeek(new Date('2026-11-23T16:00:00Z'))?.id).toBe('2026-W47');
  });

  it('is not due before 09:00 on Monday or on any other day', () => {
    expect(dueWeek(new Date('2026-11-23T01:59:00Z'))).toBeNull(); // Monday 08:59
    expect(dueWeek(new Date('2026-11-23T17:00:00Z'))).toBeNull(); // Tuesday 00:00
    expect(dueWeek(new Date('2026-11-21T02:00:00Z'))).toBeNull(); // Saturday
  });

  it('keys the outbox row by week, so reruns in the same week are no-ops', () => {
    expect(weekKey({ id: '2026-W47' })).toBe('leaderboard-week:2026-W47');
    const monday = dueWeek(new Date('2026-11-23T02:00:00Z'))!;
    const later = dueWeek(new Date('2026-11-23T12:00:00Z'))!;
    expect(weekKey(monday)).toBe(weekKey(later));
  });
});

describe('weekly leaderboard: allowed_mentions', () => {
  it('pings nobody by type, only listed snowflakes, once each', () => {
    expect(allowedMentions([A, B, A, 'everyone', '<@1>', '12'])).toEqual({
      parse: [],
      users: [A, B],
    });
  });

  it("caps the list at Discord's 100 users", () => {
    const ids = Array.from({ length: 120 }, (_, i) => String(100000000000000000n + BigInt(i)));
    expect(allowedMentions(ids).users).toHaveLength(100);
  });
});

describe('weekly leaderboard: the post', () => {
  const week = { id: '2026-W47' };
  const hubUrl = 'https://learn.example.org';

  it('posts nothing for an empty week', () => {
    expect(buildWeeklyPost({ week, rows: [], discordIds: new Map(), hubUrl })).toBeNull();
  });

  it('mentions linked members and shows the others by name only', () => {
    const post = buildWeeklyPost({
      week,
      rows: [row('u1', 1, 9, 'An'), row('u2', 2, 6, 'Bình')],
      discordIds: new Map([['u1', A]]),
      hubUrl,
    })!;
    expect(post.mentionUserIds).toEqual([A]);
    expect(post.content).toContain(`<@${A}>`);
    expect(post.content).not.toContain('Bình');
    const text = post.embeds[0].description;
    expect(text).toContain(`🥇 <@${A}> — 9 điểm`);
    expect(text).toContain('🥈 **Bình** — 6 điểm');
    expect(post.embeds[0].url).toBe('https://learn.example.org/leaderboard');
    expect(post.embeds[0].title).toContain('2026-W47');
  });

  it('never mentions a linked member who is not on the board (linking is not opt-in)', () => {
    // rows come from the leaderboard query, which only returns opted-in members;
    // u9 linked Discord but did not opt in, so it is not in `rows`
    const post = buildWeeklyPost({
      week,
      rows: [row('u1', 1, 3, 'An')],
      discordIds: new Map([
        ['u1', A],
        ['u9', B],
      ]),
      hubUrl,
    })!;
    expect(post.mentionUserIds).toEqual([A]);
    expect(post.content).not.toContain(B);
    expect(post.embeds[0].description).not.toContain(B);
  });

  it('keeps only the top 5 and never mentions anyone outside them', () => {
    const rows = Array.from({ length: 7 }, (_, i) => row(`u${i}`, i + 1, 10 - i));
    const discordIds = new Map(
      rows.map((r, i) => [r.user.id, String(300000000000000000n + BigInt(i))]),
    );
    const post = buildWeeklyPost({ week, rows, discordIds, hubUrl })!;
    expect(post.embeds[0].description.split('\n')).toHaveLength(5);
    expect(post.mentionUserIds).toHaveLength(5);
    expect(post.mentionUserIds).not.toContain(discordIds.get('u5'));
  });

  it('escapes names, so a name cannot ping or format', () => {
    const post = buildWeeklyPost({
      week,
      rows: [row('u1', 1, 3, '@everyone **x**')],
      discordIds: new Map(),
      hubUrl,
    })!;
    expect(post.embeds[0].description).not.toContain('@everyone');
    expect(post.embeds[0].description).toContain('\\*\\*x\\*\\*');
    expect(post.mentionUserIds).toEqual([]);
  });

  it('never mentions a stored id that is not a snowflake', () => {
    const post = buildWeeklyPost({
      week,
      rows: [row('u1', 1, 3, 'An')],
      discordIds: new Map([['u1', '123> @everyone']]),
      hubUrl,
    })!;
    expect(post.mentionUserIds).toEqual([]);
    expect(post.content).not.toContain('<@');
  });

  it('gives tied members the same medal', () => {
    const post = buildWeeklyPost({
      week,
      rows: [row('u1', 1, 3, 'An'), row('u2', 1, 3, 'Bình'), row('u3', 2, 1, 'Chi')],
      discordIds: new Map(),
      hubUrl,
    })!;
    const lines = post.embeds[0].description.split('\n');
    expect(lines[0].startsWith('🥇')).toBe(true);
    expect(lines[1].startsWith('🥇')).toBe(true);
    expect(lines[2].startsWith('🥈')).toBe(true);
  });
});
