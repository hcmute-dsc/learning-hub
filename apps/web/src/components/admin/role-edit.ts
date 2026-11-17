import type { Role } from '@hub/shared';

/** Pure helpers for editing an account's roles (tested in role-edit.test.ts). */

/** Every account keeps `member`, so only these are checkboxes. */
export const EDITABLE_ROLES: Role[] = ['mentor', 'content_maintainer', 'admin'];

/** Add or remove one role; `member` always stays and the order follows EDITABLE_ROLES. */
export function toggleRole(roles: Role[], role: Role): Role[] {
  const set = new Set(roles);
  if (set.has(role)) set.delete(role);
  else set.add(role);
  return ['member', ...EDITABLE_ROLES.filter((r) => set.has(r))];
}

export function sameRoles(a: Role[], b: Role[]): boolean {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((r) => y.has(r));
}

/** Admin sees every email and can change anyone's roles, so granting it asks first. */
export function grantsAdmin(before: Role[], after: Role[]): boolean {
  return !before.includes('admin') && after.includes('admin');
}

/**
 * Why a checkbox cannot be changed, or null. The API refuses the same thing
 * (account-rules.ts); disabling it here saves a round trip and explains why.
 */
export function roleLockReason(role: Role, current: Role[], isSelf: boolean): string | null {
  if (role === 'admin' && isSelf && current.includes('admin')) {
    return 'Bạn không thể tự bỏ quyền admin của mình. Nhờ một admin khác làm việc này.';
  }
  return null;
}
