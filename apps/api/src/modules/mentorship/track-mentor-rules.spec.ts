import { assertCanMentorTrack, toAdminMentorRows } from './track-mentor-rules';

const person = (id: string, displayName: string) => ({
  id,
  githubLogin: id,
  displayName,
  avatarUrl: null,
});

describe('assertCanMentorTrack', () => {
  const active = { status: 'active', deletedAt: null, roles: ['member', 'mentor'] };

  it('accepts an active account with the mentor role', () => {
    expect(() => assertCanMentorTrack(active)).not.toThrow();
  });

  it('is 404 for a missing or deleted account', () => {
    expect(() => assertCanMentorTrack(null)).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => assertCanMentorTrack({ ...active, deletedAt: new Date() })).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('refuses pending or suspended accounts', () => {
    for (const status of ['pending', 'suspended']) {
      expect(() => assertCanMentorTrack({ ...active, status })).toThrow(
        expect.objectContaining({ status: 409 }),
      );
    }
  });

  it('refuses an admin without the mentor role', () => {
    expect(() => assertCanMentorTrack({ ...active, roles: ['member', 'admin'] })).toThrow(
      expect.objectContaining({ status: 409, message: expect.stringContaining('vai trò mentor') }),
    );
  });
});

describe('toAdminMentorRows', () => {
  const since = new Date('2026-11-20T03:00:00Z');

  it('lists every mentor by name, with their tracks in catalog order', () => {
    const rows = toAdminMentorRows(
      [person('b', 'Bình'), person('a', 'An'), person('c', 'Châu')],
      [
        {
          mentorId: 'a',
          startedAt: since,
          track: { slug: 'docker', title: 'Docker', position: 2 },
        },
        { mentorId: 'a', startedAt: since, track: { slug: 'git', title: 'Git', position: 1 } },
        { mentorId: 'c', startedAt: since, track: { slug: 'sql', title: 'SQL', position: 3 } },
      ],
      new Map([['a', 4]]),
    );

    expect(rows.map((r) => r.mentor.displayName)).toEqual(['An', 'Bình', 'Châu']);
    expect(rows[0].tracks.map((t) => t.slug)).toEqual(['git', 'docker']);
    expect(rows[0].tracks[0].since).toBe('2026-11-20T03:00:00.000Z');
    expect(rows[0].activeMentees).toBe(4);
  });

  it('keeps mentors with no track and no mentee, so the admin sees who is free', () => {
    const [row] = toAdminMentorRows([person('b', 'Bình')], [], new Map());
    expect(row).toEqual({ mentor: person('b', 'Bình'), tracks: [], activeMentees: 0 });
  });
});
