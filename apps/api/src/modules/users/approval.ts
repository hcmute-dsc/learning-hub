/**
 * Who is let in automatically (decided 16/11/2026 — SECURITY §1, USER-FLOWS §1).
 * Pure functions: easy to read and to test without a database.
 */

export type ApprovalReason = 'approved_email' | 'bootstrap_admin' | 'org_member';

export interface SignInFacts {
  login: string;
  /** All verified emails on the GitHub account, lower-cased */
  verifiedEmails: string[];
  /** null when the optional org check is off or failed */
  isOrgMember: boolean | null;
}

/**
 * Why this sign-in may become `active`, or null when an admin/mentor must approve it.
 * `isApproved(email)` answers "is this email on the club's list?".
 */
export function approvalReason(
  facts: SignInFacts,
  isApproved: (email: string) => boolean,
  bootstrapAdminLogin: string | undefined,
): ApprovalReason | null {
  if (bootstrapAdminLogin && facts.login.toLowerCase() === bootstrapAdminLogin)
    return 'bootstrap_admin';
  if (facts.verifiedEmails.some(isApproved)) return 'approved_email';
  if (facts.isOrgMember === true) return 'org_member';
  return null;
}

/** Trim + lower-case, the only form stored in approved_emails. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
