import {
  assertEnrolled,
  assertHasRoom,
  assertNotSelf,
  planAssignment,
  toMenteeRows,
  toMentorChoices,
} from './mentee-mentor-rules';

const person = (id: string, displayName: string) => ({
  id,
  githubLogin: id,
  displayName,
  avatarUrl: null,
});

describe('planAssignment', () => {
  const active = { id: 'a1', status: 'active', mentorId: 'm1' };
  const requested = { id: 'r1', status: 'requested', mentorId: null };

  it('creates a row when nothing is open, and does nothing when removing nothing', () => {
    expect(planAssignment(null, 'm1')).toBe('create');
    expect(planAssignment(null, null)).toBe('none');
  });

  it('keeps the same mentor as is, and replaces a different one (history kept)', () => {
    expect(planAssignment(active, 'm1')).toBe('none');
    expect(planAssignment(active, 'm2')).toBe('replace');
  });

  it('fulfils a member request in place, and ends a row when the mentor is removed', () => {
    expect(planAssignment(requested, 'm1')).toBe('activate');
    expect(planAssignment(requested, null)).toBe('end');
    expect(planAssignment(active, null)).toBe('end');
  });
});

describe('guards', () => {
  it('refuses a member as their own mentor', () => {
    expect(() => assertNotSelf('u1', 'u1')).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => assertNotSelf('u1', 'u2')).not.toThrow();
  });

  it('needs an enrollment that is not dropped', () => {
    expect(() => assertEnrolled(null)).toThrow(expect.objectContaining({ status: 409 }));
    expect(() => assertEnrolled({ status: 'dropped' })).toThrow(
      expect.objectContaining({ status: 409 }),
    );
    expect(() => assertEnrolled({ status: 'active' })).not.toThrow();
    expect(() => assertEnrolled({ status: 'completed' })).not.toThrow();
  });

  it('stops at MENTOR_MAX_MENTEES', () => {
    expect(() => assertHasRoom(4, 5)).not.toThrow();
    expect(() => assertHasRoom(5, 5)).toThrow(
      expect.objectContaining({ status: 409, message: expect.stringContaining('đủ 5 mentee') }),
    );
  });
});

describe('toMentorChoices', () => {
  it('puts the mentors of this track first, then sorts by name, with mentee counts', () => {
    const choices = toMentorChoices(
      [person('b', 'Bình'), person('a', 'An'), person('c', 'Châu')],
      new Set(['c']),
      new Map([['a', 2]]),
    );
    expect(choices.map((c) => c.mentor.id)).toEqual(['c', 'a', 'b']);
    expect(choices[0].inTrack).toBe(true);
    expect(choices[1]).toMatchObject({ inTrack: false, activeMentees: 2 });
  });
});

describe('toMenteeRows', () => {
  it('lists every enrolled member by name, with their mentor and since when', () => {
    const since = new Date('2026-11-27T01:00:00Z');
    const rows = toMenteeRows(
      [person('y', 'Yến'), person('x', 'Xuân')],
      [{ menteeId: 'y', mentor: person('m', 'Mentor'), startedAt: since }],
    );
    expect(rows.map((r) => r.member.id)).toEqual(['x', 'y']);
    expect(rows[0]).toMatchObject({ mentor: null, since: null });
    expect(rows[1]).toMatchObject({ mentor: { id: 'm' }, since: since.toISOString() });
  });
});
