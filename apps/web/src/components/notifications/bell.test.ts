import { describe, expect, it } from 'vitest';
import type { NotificationItem } from '@hub/shared';
import { badgeLabel, bellLabel, markEveryRead, markOneRead } from './bell';

const item = (id: string, read: boolean): NotificationItem => ({
  id,
  type: 'track_published',
  title: id,
  body: null,
  link: '/tracks/x',
  read,
  createdAt: '2026-11-18T00:00:00Z',
});

describe('bell badge', () => {
  it('hides at zero and caps at 9+', () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(3)).toBe('3');
    expect(badgeLabel(10)).toBe('9+');
  });

  it('names the unread count for screen readers', () => {
    expect(bellLabel(0)).toBe('Thông báo');
    expect(bellLabel(2)).toBe('Thông báo, 2 chưa đọc');
  });
});

describe('read state', () => {
  it('marks one unread item and lowers the count', () => {
    const { items, unread } = markOneRead([item('a', false), item('b', false)], 'a', 2);
    expect(items.map((i) => i.read)).toEqual([true, false]);
    expect(unread).toBe(1);
  });

  it('keeps the count for an item already read or unknown', () => {
    expect(markOneRead([item('a', true)], 'a', 4).unread).toBe(4);
    expect(markOneRead([item('a', false)], 'zz', 4).unread).toBe(4);
  });

  it('marks everything read', () => {
    expect(markEveryRead([item('a', false), item('b', true)]).every((i) => i.read)).toBe(true);
  });
});
