import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { LeaderboardPostStatus, Me } from '@hub/shared';
import { LeaderboardPostActions } from '@/components/admin/LeaderboardPostActions';
import { POST_STATE_LABEL } from '@/components/admin/leaderboard-post';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Bảng xếp hạng tuần' };

/**
 * Admin "Bảng xếp hạng" (learning-hub#83): last week's post on the club Discord channel.
 * The job posts it on Monday at 09:00; here an admin can post it earlier or edit it.
 */
export default async function AdminLeaderboardPage() {
  const { data: me } = await api<{ data: Me }>('/auth/me');
  if (!me.roles.includes('admin')) notFound();
  const { data: status } = await api<{ data: LeaderboardPostStatus }>('/admin/leaderboard-post');
  const lastDay = new Date(Date.parse(status.endsAt) - 1).toISOString();

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Bảng xếp hạng tuần trên Discord</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Sáng thứ Hai lúc 9:00, Learning Hub tự đăng top 5 của tuần trước lên kênh CLB. Ở đây bạn
          đăng sớm hơn, hoặc tính lại bảng và sửa bài đã đăng (ví dụ mentor duyệt bài muộn). Sửa bài
          không tag lại ai. Chỉ thành viên đã bật bảng xếp hạng mới có tên. Mọi lần đăng và sửa đều
          ghi vào Nhật ký.
        </p>
      </header>

      <section className="surface space-y-4 rounded-xl p-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="muted">Tuần</dt>
          <dd>
            {status.weekId} ({formatDateTime(status.startsAt)} → {formatDateTime(lastDay)})
          </dd>
          <dt className="muted">Trạng thái</dt>
          <dd className="font-medium">{POST_STATE_LABEL[status.state]}</dd>
          {status.postedAt && (
            <>
              <dt className="muted">Đăng lúc</dt>
              <dd>{formatDateTime(status.postedAt)}</dd>
            </>
          )}
          {status.updatedAt && (
            <>
              <dt className="muted">Sửa lần cuối</dt>
              <dd>{formatDateTime(status.updatedAt)}</dd>
            </>
          )}
        </dl>

        <div>
          <h2 className="text-sm font-semibold">Bảng tính lại lúc này</h2>
          {status.preview.length === 0 ? (
            <p className="muted mt-1 text-sm italic">Chưa có ai.</p>
          ) : (
            <ol className="mt-1 space-y-1 text-sm">
              {status.preview.map((r) => (
                <li key={r.user.id}>
                  #{r.rank} {r.user.displayName} — {r.score} điểm ({r.completed} bài)
                </li>
              ))}
            </ol>
          )}
        </div>

        <LeaderboardPostActions status={status} />
      </section>
    </section>
  );
}
