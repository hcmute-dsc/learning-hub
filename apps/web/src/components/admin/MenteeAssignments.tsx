import Link from 'next/link';
import type { MenteeAssignmentsView } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { formatLongDate } from '@/lib/format';
import { MenteeMentorCell } from './MenteeMentorCell';

/**
 * "Mentee theo track" on /admin/mentors (US-11, learning-hub#120): pick a track, then give
 * each enrolled member a mentor. The chosen track is in the URL (`?track=`), so the page
 * works without JavaScript and a link can be shared between admins.
 */
export function MenteeAssignments({
  tracks,
  view,
}: {
  tracks: { slug: string; title: string }[];
  view: MenteeAssignmentsView | null;
}) {
  return (
    <section aria-labelledby="mentee-list" className="surface rounded-xl p-5">
      <h2 id="mentee-list" className="font-semibold">
        Mentee theo track
      </h2>
      <p className="muted mt-1 text-sm">
        Mỗi thành viên có tối đa một mentor trong một track. Một mentor kèm tối đa{' '}
        {view?.maxMentees ?? 'số'} mentee trên mọi track. Đổi mentor không xoá lịch sử. Mentor thấy
        mentee của mình ở bộ lọc &quot;Mentee của tôi&quot; trong hàng đợi review.
      </p>

      {tracks.length === 0 ? (
        <p className="muted mt-3 text-sm">Chưa có track nào đang mở.</p>
      ) : (
        <nav aria-label="Chọn track" className="mt-4 flex flex-wrap gap-1.5">
          {tracks.map((t) => {
            const active = view?.track.slug === t.slug;
            return (
              <Link
                key={t.slug}
                href={`/admin/mentors?track=${encodeURIComponent(t.slug)}#mentee-list`}
                aria-current={active ? 'page' : undefined}
                scroll={false}
                className={`rounded-full border px-3 py-1 text-sm ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-[var(--border)] hover:border-brand-500'
                }`}
              >
                {t.title}
              </Link>
            );
          })}
        </nav>
      )}

      {view && <MenteeTable view={view} />}
    </section>
  );
}

function MenteeTable({ view }: { view: MenteeAssignmentsView }) {
  if (view.members.length === 0) {
    return (
      <p className="muted mt-4 text-sm">Chưa có thành viên nào ghi danh {view.track.title}.</p>
    );
  }
  if (view.mentors.length === 0) {
    return (
      <p className="muted mt-4 text-sm">
        Chưa có mentor nào. Cấp vai trò mentor ở trang{' '}
        <Link href="/admin/members" className="underline">
          Thành viên
        </Link>{' '}
        trước.
      </p>
    );
  }
  const withMentor = view.members.filter((m) => m.mentor).length;
  return (
    <div className="mt-4">
      <p className="text-sm">
        {view.track.title}: {view.members.length} thành viên ghi danh, {withMentor} đã có mentor.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="stack-table w-full text-left text-sm">
          <thead className="muted">
            <tr>
              <th className="py-1 pr-4 font-medium">Thành viên</th>
              <th className="py-1 pr-4 font-medium">Mentor</th>
              <th className="py-1 font-medium">Từ ngày</th>
            </tr>
          </thead>
          <tbody className="divide-[var(--border)] md:divide-y">
            {view.members.map((row) => (
              <tr key={row.member.id} className="align-top">
                <td className="md:py-2.5 md:pr-4">
                  <span className="flex items-center gap-2">
                    <Avatar src={row.member.avatarUrl} size={24} />
                    <Link
                      href={`/u/${encodeURIComponent(row.member.githubLogin)}`}
                      prefetch={false}
                      className="hover:underline"
                    >
                      {row.member.displayName}
                    </Link>
                  </span>
                </td>
                <td data-label="Mentor" className="md:py-2.5 md:pr-4">
                  <MenteeMentorCell
                    row={row}
                    trackSlug={view.track.slug}
                    mentors={view.mentors}
                    maxMentees={view.maxMentees}
                  />
                </td>
                <td data-label="Từ ngày" className="whitespace-nowrap md:py-2.5">
                  {row.since ? formatLongDate(row.since) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
