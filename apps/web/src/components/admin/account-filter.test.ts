import { describe, expect, it } from 'vitest';
import type { AdminUserRow } from '@hub/shared';
import { countByStatus, emailsText, filterAccounts } from './account-filter';

const row = (over: Partial<AdminUserRow>): AdminUserRow => ({
  id: over.githubLogin ?? 'x',
  githubLogin: 'x',
  displayName: 'X',
  avatarUrl: null,
  email: null,
  status: 'active',
  roles: ['member'],
  onEmailList: false,
  createdAt: '2026-11-17T00:00:00Z',
  lastLoginAt: null,
  ...over,
});

const rows = [
  row({
    githubLogin: 'ThuyLinh09',
    displayName: 'Thùy Linh',
    status: 'pending',
    email: 'linh@gmail.com',
  }),
  row({ githubLogin: 'TienNHM', displayName: 'Tiến', email: 'tien@student.hcmute.edu.vn' }),
  row({ githubLogin: 'old', displayName: 'Cũ', status: 'suspended' }),
];

describe('filterAccounts', () => {
  it('filters by status', () => {
    expect(filterAccounts(rows, 'pending', '').map((r) => r.githubLogin)).toEqual(['ThuyLinh09']);
    expect(filterAccounts(rows, 'all', '')).toHaveLength(3);
  });

  it('searches name, login and email, ignoring case', () => {
    expect(filterAccounts(rows, 'all', 'thuylinh').map((r) => r.githubLogin)).toEqual([
      'ThuyLinh09',
    ]);
    expect(filterAccounts(rows, 'all', 'HCMUTE').map((r) => r.githubLogin)).toEqual(['TienNHM']);
    expect(filterAccounts(rows, 'all', 'Tiến')).toHaveLength(1);
  });
});

describe('countByStatus', () => {
  it('counts every tab', () => {
    expect(countByStatus(rows)).toEqual({ all: 3, pending: 1, active: 1, suspended: 1 });
  });
});

describe('emailsText', () => {
  it('joins emails one per line and skips accounts without one', () => {
    expect(emailsText(rows)).toBe('linh@gmail.com\ntien@student.hcmute.edu.vn');
  });
});
