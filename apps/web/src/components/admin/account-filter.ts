import type { AdminUserRow, UserStatus } from '@hub/shared';

/** Pure helpers for AccountsTable (tested in account-filter.test.ts). */

export type StatusFilter = 'all' | UserStatus;

export const STATUS_LABEL: Record<UserStatus, string> = {
  pending: 'Chờ duyệt',
  active: 'Đang hoạt động',
  suspended: 'Tạm khóa',
};

/** Rows matching the status tab and the search text (name, GitHub login or email). */
export function filterAccounts(
  rows: AdminUserRow[],
  status: StatusFilter,
  search: string,
): AdminUserRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      (!q ||
        row.displayName.toLowerCase().includes(q) ||
        row.githubLogin.toLowerCase().includes(q) ||
        (row.email ?? '').toLowerCase().includes(q)),
  );
}

/** Number of accounts per tab, for the tab labels. */
export function countByStatus(rows: AdminUserRow[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: rows.length,
    pending: 0,
    active: 0,
    suspended: 0,
  };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** Emails of the given rows, one per line, for "Chép email" (empty emails skipped). */
export function emailsText(rows: AdminUserRow[]): string {
  return rows
    .map((row) => row.email)
    .filter((email): email is string => !!email)
    .join('\n');
}
