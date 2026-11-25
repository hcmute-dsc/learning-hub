import { describe, expect, it } from 'vitest';
import { menteeCountLabel, tracksToAdd } from './mentor-tracks';

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
