import type { AuditLogRow, Role } from '@hub/shared';
import { ROLE_LABEL } from '@/components/profile/profile';
import { STATUS_LABEL } from './account-filter';
import { shortSha, VERSION_STATUS_LABEL } from './content-version';

/** Pure helpers for /admin/audit (tested in audit-format.test.ts). */

/**
 * Vietnamese names of the actions audit.listener.ts writes. Actions added later by
 * other modules still show, as their code, until a label is added here.
 */
const ACTION_LABEL: Record<string, string> = {
  'user.register': 'Tài khoản mới',
  'user.approve': 'Duyệt tài khoản',
  'user.suspend': 'Tạm khóa tài khoản',
  'user.reactivate': 'Mở khóa tài khoản',
  'role.set': 'Đổi vai trò',
  'approved_emails.update': 'Cập nhật danh sách email',
  'content.sync': 'Đồng bộ nội dung',
  'content.publish': 'Publish nội dung',
  'content.reject': 'Từ chối nội dung',
};

export const actionLabel = (action: string) => ACTION_LABEL[action] ?? action;

const APPROVAL_REASON: Record<string, string> = {
  approved_email: 'email có trong danh sách CLB',
  bootstrap_admin: 'admin đầu tiên',
  org_member: 'thành viên GitHub org',
  manual: 'duyệt tay',
};

const num = (v: unknown) => (typeof v === 'number' ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function roleList(v: unknown): string {
  if (!Array.isArray(v)) return '—';
  const labels = v
    .filter((r): r is Role => typeof r === 'string' && r in ROLE_LABEL)
    .map((r) => ROLE_LABEL[r]);
  return labels.length ? labels.join(', ') : '—';
}

const statusLabel = (v: unknown) =>
  STATUS_LABEL[str(v) as keyof typeof STATUS_LABEL] ?? (str(v) || '—');

/**
 * One line that says what changed, from the metadata. The audit log stores counts
 * only for the email list (SECURITY §1), so there is never an address to show.
 */
export function describeAudit(row: Pick<AuditLogRow, 'action' | 'metadata'>): string {
  const m = row.metadata;
  switch (row.action) {
    case 'role.set':
      return 'previousRoles' in m
        ? `${roleList(m.previousRoles)} → ${roleList(m.roles)}`
        : `Vai trò: ${roleList(m.roles)}`;
    case 'user.register':
      return `${statusLabel(m.status)}${m.reason ? ` (${APPROVAL_REASON[str(m.reason)] ?? str(m.reason)})` : ''}`;
    case 'user.approve':
      return APPROVAL_REASON[str(m.reason)] ?? str(m.reason);
    case 'user.suspend':
      return m.previousStatus ? `Trước đó: ${statusLabel(m.previousStatus)}` : '';
    case 'approved_emails.update':
      return `${str(m.mode) === 'replace' ? 'Thay toàn bộ' : 'Thêm'}: ${num(m.submitted)} email gửi lên, tổng ${num(m.total)}, kích hoạt ${num(m.activated)} tài khoản`;
    case 'content.sync': {
      const status = VERSION_STATUS_LABEL[str(m.status) as keyof typeof VERSION_STATUS_LABEL];
      return `Commit ${shortSha(str(m.commitSha))}${status ? ` → ${status}` : ''}`;
    }
    case 'content.publish':
    case 'content.reject':
      return `Commit ${shortSha(str(m.commitSha))}`;
    default:
      return Object.keys(m).length ? JSON.stringify(m) : '';
  }
}
