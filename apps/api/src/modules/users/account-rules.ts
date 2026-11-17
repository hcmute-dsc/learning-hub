import type { Role, UserStatus } from '@hub/shared';

/**
 * Rules for admin actions on accounts (SECURITY §2, USER-FLOWS §1). Pure functions:
 * the service loads the facts, these decide, and the tests need no database.
 * Each returns the reason it is refused, or null when the action is allowed.
 */

export interface RoleChangeFacts {
  actorId: string;
  targetId: string;
  /** roles the target has now */
  currentRoles: Role[];
  /** roles asked for (`member` is added by the service anyway) */
  nextRoles: Role[];
  /** active, not deleted accounts that hold `admin` today, the target included */
  activeAdminCount: number;
}

export function roleChangeRefusal(f: RoleChangeFacts): string | null {
  const removesAdmin = f.currentRoles.includes('admin') && !f.nextRoles.includes('admin');
  if (!removesAdmin) return null;
  // Otherwise an admin could lock themselves out by mistake; another admin must do it.
  if (f.actorId === f.targetId) return 'You cannot remove your own admin role';
  // Nobody would be left to manage roles, the email list or content publishing.
  if (f.activeAdminCount <= 1) return 'The last admin cannot be demoted';
  return null;
}

export interface SuspendFacts {
  actorId: string;
  targetId: string;
  targetStatus: UserStatus;
}

export function suspendRefusal(f: SuspendFacts): string | null {
  if (f.actorId === f.targetId) return 'You cannot suspend your own account';
  if (f.targetStatus === 'suspended') return 'This account is already suspended';
  return null;
}

export function reactivateRefusal(targetStatus: UserStatus): string | null {
  // A pending account is approved instead, so the approval stays in the audit log.
  if (targetStatus !== 'suspended') return 'Only a suspended account can be reactivated';
  return null;
}
