import { describe, expect, it } from 'vitest';
import type { Me } from '@hub/shared';
import { accountLinksFor, canReview, isActivePath, mainLinksFor } from './nav';

const person = (roles: Me['roles'], status: Me['status'] = 'active'): Me => ({
  id: '00000000-0000-0000-0000-000000000001',
  githubLogin: 'mai',
  displayName: 'Mai',
  avatarUrl: null,
  status,
  roles,
  bio: null,
  theme: 'system',
  showAchievements: true,
  leaderboardOptIn: false,
});

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('mainLinksFor', () => {
  it('gives guests none, since every page behind them asks to sign in', () => {
    expect(mainLinksFor(null)).toEqual([]);
  });

  it('gives members three links and no Review', () => {
    expect(labels(mainLinksFor(person(['member'])))).toEqual([
      'Bảng điều khiển',
      'Lộ trình',
      'Xếp hạng',
    ]);
    expect(labels(mainLinksFor(person(['member', 'content_maintainer'])))).not.toContain('Review');
  });

  it('adds Review for mentors and admins, never more than four links', () => {
    for (const roles of [
      ['member', 'mentor'],
      ['member', 'admin'],
    ] as Me['roles'][]) {
      const links = labels(mainLinksFor(person(roles)));
      expect(links.at(-1)).toBe('Review');
      expect(links.length).toBeLessThanOrEqual(4);
    }
  });

  it('never puts the admin area in the main links', () => {
    expect(labels(mainLinksFor(person(['member', 'admin'])))).not.toContain('Quản trị');
  });
});

describe('canReview', () => {
  it('is true for mentors and admins only', () => {
    expect(canReview(null)).toBe(false);
    expect(canReview(person(['member']))).toBe(false);
    expect(canReview(person(['member', 'mentor']))).toBe(true);
    expect(canReview(person(['member', 'admin']))).toBe(true);
  });
});

describe('accountLinksFor', () => {
  it('lists the profile and settings for everyone', () => {
    expect(accountLinksFor(person(['member'])).map(({ href, label }) => ({ href, label }))).toEqual(
      [
        { href: '/u/mai', label: 'Hồ sơ của tôi' },
        { href: '/settings', label: 'Cài đặt' },
      ],
    );
  });

  it('adds "Quản trị" pointing at the first admin tab the person may open', () => {
    const admin = (roles: Me['roles']) =>
      accountLinksFor(person(roles)).find((l) => l.label === 'Quản trị')?.href;
    expect(admin(['member', 'admin'])).toBe('/admin');
    expect(admin(['member', 'mentor'])).toBe('/admin/members');
    expect(admin(['member', 'content_maintainer'])).toBe('/admin/content');
    expect(admin(['member'])).toBeUndefined();
  });
});

describe('isActivePath', () => {
  it('matches the section and its sub-pages, not a lookalike prefix', () => {
    expect(isActivePath('/tracks', '/tracks')).toBe(true);
    expect(isActivePath('/tracks', '/tracks/sql-30-days/lessons/1')).toBe(true);
    expect(isActivePath('/review', '/reviewers')).toBe(false);
  });
});
