import { describe, expect, it } from 'vitest';
import { isMentorFull, menteeCountLabel, mentorOptionLabel, tracksToAdd } from './mentor-tracks';

describe('tracksToAdd', () => {
  const all = [
    { slug: 'git', title: 'Git' },
    { slug: 'docker', title: 'Docker' },
    { slug: 'sql', title: 'SQL' },
  ];

  it('leaves out the tracks the mentor already has, keeping catalog order', () => {
    const assigned = [{ slug: 'docker', title: 'Docker', since: '2026-11-20T00:00:00Z' }];
    expect(tracksToAdd(all, assigned).map((t) => t.slug)).toEqual(['git', 'sql']);
  });

  it('is empty when the mentor has every track', () => {
    const assigned = all.map((t) => ({ ...t, since: '2026-11-20T00:00:00Z' }));
    expect(tracksToAdd(all, assigned)).toEqual([]);
  });
});

describe('menteeCountLabel', () => {
  it('says when a mentor has no mentee yet', () => {
    expect(menteeCountLabel(0)).toBe('Chưa kèm mentee');
    expect(menteeCountLabel(3)).toBe('3 mentee');
  });
});

describe('mentor picker for a mentee', () => {
  const choice = (id: string, activeMentees: number) => ({
    mentor: { id, githubLogin: id, displayName: `Mentor ${id}`, avatarUrl: null },
    activeMentees,
    inTrack: false,
  });

  it('shows how full each mentor is', () => {
    expect(mentorOptionLabel(choice('a', 3), 5)).toBe('Mentor a · 3/5 mentee');
  });

  it('blocks a full mentor for new mentees but not for their own', () => {
    expect(isMentorFull(choice('a', 5), 5, null)).toBe(true);
    expect(isMentorFull(choice('a', 5), 5, 'a')).toBe(false);
    expect(isMentorFull(choice('a', 4), 5, null)).toBe(false);
  });
});
