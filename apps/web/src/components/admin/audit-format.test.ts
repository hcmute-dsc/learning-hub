import { describe, expect, it } from 'vitest';
import { actionLabel, describeAudit } from './audit-format';

describe('actionLabel', () => {
  it('names known actions and falls back to the code', () => {
    expect(actionLabel('role.set')).toBe('Đổi vai trò');
    expect(actionLabel('review.complete')).toBe('Hoàn thành review');
    expect(actionLabel('something.new')).toBe('something.new');
  });
});

describe('describeAudit', () => {
  it('shows a role change as before → after', () => {
    expect(
      describeAudit({
        action: 'role.set',
        metadata: { previousRoles: ['member'], roles: ['member', 'mentor'] },
      }),
    ).toBe('Thành viên → Thành viên, Mentor');
  });

  it('still reads older role.set rows without previousRoles', () => {
    expect(describeAudit({ action: 'role.set', metadata: { roles: ['admin'] } })).toBe(
      'Vai trò: Ban chủ nhiệm',
    );
  });

  it('shows email list changes as counts only', () => {
    const text = describeAudit({
      action: 'approved_emails.update',
      metadata: { mode: 'append', submitted: 12, total: 40, activated: 2 },
    });
    expect(text).toBe('Thêm: 12 email gửi lên, tổng 40, kích hoạt 2 tài khoản');
    expect(text).not.toContain('@');
  });

  it('shortens commit SHAs', () => {
    expect(
      describeAudit({
        action: 'content.sync',
        metadata: { commitSha: 'abcdef0123456789', status: 'draft' },
      }),
    ).toBe('Commit abcdef0 → Bản nháp');
  });

  it('explains approvals and suspensions', () => {
    expect(describeAudit({ action: 'user.approve', metadata: { reason: 'manual' } })).toBe(
      'duyệt tay',
    );
    expect(describeAudit({ action: 'user.suspend', metadata: { previousStatus: 'active' } })).toBe(
      'Trước đó: Đang hoạt động',
    );
  });

  it('shows a mentor review outcome without member ids', () => {
    const text = describeAudit({
      action: 'review.complete',
      metadata: { outcome: 'changes_requested', memberId: 'u1', submissionId: 's1' },
    });
    expect(text).toBe('Kết luận: Cần sửa');
  });

  it('shows the track and the reason of a revoked certificate', () => {
    expect(actionLabel('certificate.revoke')).toBe('Thu hồi chứng nhận');
    const text = describeAudit({
      action: 'certificate.revoke',
      metadata: { trackSlug: 'sql-30-days', reason: 'nộp bài của người khác', userId: 'u1' },
    });
    expect(text).toBe('Lộ trình sql-30-days: nộp bài của người khác');
  });

  it('prints unknown metadata as JSON, and nothing when empty', () => {
    expect(describeAudit({ action: 'x.y', metadata: { a: 1 } })).toBe('{"a":1}');
    expect(describeAudit({ action: 'user.reactivate', metadata: {} })).toBe('');
  });
  it('names the Discord account a member linked or unlinked', () => {
    expect(
      describeAudit({ action: 'user.discord_link', metadata: { discordUsername: 'an' } }),
    ).toBe('Discord: an');
    expect(describeAudit({ action: 'user.discord_unlink', metadata: {} })).toBe('Discord: —');
  });

  it('describes the weekly leaderboard post actions (learning-hub#83)', () => {
    expect(describeAudit({ action: 'leaderboard.update', metadata: { members: 3 } })).toBe(
      '3 thành viên trong bài',
    );
  });

  it('describes a report export without listing any member (learning-hub#34)', () => {
    const metadata = { table: 'members', from: '2026-11-23', to: '2026-11-29', rows: 21 };
    expect(
      describeAudit({
        action: 'report.export',
        metadata: { ...metadata, track: 'sql-30-days', cohort: 'sql-2026', anonymized: true },
      }),
    ).toBe(
      'Bảng thành viên, 2026-11-23 → 2026-11-29, track sql-30-days, đợt sql-2026, 21 dòng, ẩn danh',
    );
    expect(
      describeAudit({
        action: 'report.export',
        metadata: { ...metadata, table: 'summary', track: null, cohort: '-', anonymized: false },
      }),
    ).toBe('Bảng tổng hợp, 2026-11-23 → 2026-11-29, track tất cả, chưa gắn đợt, 21 dòng');
  });
});

describe('content report audit lines (learning-hub#121)', () => {
  it('names the action and says what changed, without the report text', () => {
    expect(actionLabel('content_report.status')).toBe('Xử lý báo lỗi nội dung');
    expect(
      describeAudit({
        action: 'content_report.status',
        metadata: { trackSlug: 'sql', from: 'open', to: 'resolved' },
      }),
    ).toBe('sql: Mới → Đã sửa');
    expect(
      describeAudit({
        action: 'content_report.issue',
        metadata: { trackSlug: 'sql', issueUrl: 'https://github.com/o/r/issues/1' },
      }),
    ).toBe('sql: https://github.com/o/r/issues/1');
  });
});

describe('track mentor audit lines (learning-hub#120)', () => {
  it('names the mentor by login and the track', () => {
    expect(actionLabel('mentor.track_assign')).toBe('Giao mentor phụ trách track');
    expect(actionLabel('mentor.track_end')).toBe('Thôi giao mentor phụ trách track');
    expect(
      describeAudit({
        action: 'mentor.track_end',
        metadata: { mentorId: 'x', mentorLogin: 'mentor1', track: 'git-basics' },
      }),
    ).toBe('@mentor1 · git-basics');
  });
});
