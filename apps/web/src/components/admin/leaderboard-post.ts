import type { LeaderboardPostStatus } from '@hub/shared';

/** Pure helpers for /admin/leaderboard (tested in leaderboard-post.test.ts). */

export const POST_STATE_LABEL: Record<LeaderboardPostStatus['state'], string> = {
  not_posted: 'Chưa đăng',
  queued: 'Đang chờ đăng (Discord lỗi, tự thử lại)',
  posted: 'Đã đăng trên Discord',
};

/**
 * Which button the admin gets (learning-hub#83): "Đăng ngay" until the week is on
 * Discord, then only "Cập nhật". Nothing while it waits in the outbox, without a club
 * webhook, or (for posting) when nobody is on last week's board.
 */
export function postActions(status: LeaderboardPostStatus): {
  canPost: boolean;
  canUpdate: boolean;
  hint: string | null;
} {
  if (!status.enabled) {
    return { canPost: false, canUpdate: false, hint: 'Chưa cấu hình webhook kênh CLB.' };
  }
  if (status.state === 'queued') {
    return { canPost: false, canUpdate: false, hint: 'Bài đang trong hàng đợi, sẽ tự đăng.' };
  }
  if (status.state === 'posted') {
    return {
      canPost: false,
      canUpdate: status.preview.length > 0,
      hint: status.preview.length ? null : 'Bảng tuần này giờ không còn ai, nên không sửa bài.',
    };
  }
  return {
    canPost: status.preview.length > 0,
    canUpdate: false,
    hint: status.preview.length ? null : 'Tuần trước chưa có ai trên bảng, không có gì để đăng.',
  };
}
