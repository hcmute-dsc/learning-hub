import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TRACK_SLUG_PATTERN, type AdminMentorsView, type MenteeAssignmentsView } from '@hub/shared';
import { MenteeAssignments } from '@/components/admin/MenteeAssignments';
import { MentorTracksCell } from '@/components/admin/MentorTracksCell';
import { menteeCountLabel } from '@/components/admin/mentor-tracks';
import { Avatar } from '@/components/ui/Avatar';
import { api, getMe } from '@/lib/api';

export const metadata: Metadata = { title: 'Mentor' };

/**
 * Admin "Mentor" (learning-hub#120): which mentor looks after which track, and each
 * member's mentor in a track (`?track=`, US-11). Admin only; the API checks the role again.
 * A mentor is an active account with the mentor role, given on "Thành viên".
 */
export default async function MentorsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string | string[] }>;
}) {
  const me = await getMe();
  if (!me?.roles.includes('admin')) notFound();
  const { mentors, tracks } = (await api<{ data: AdminMentorsView }>('/admin/mentors')).data;
  const asked = (await searchParams).track;
  // An unknown or malformed ?track= falls back to the first track instead of an error page.
  const slug =
    tracks.find((t) => t.slug === asked && TRACK_SLUG_PATTERN.test(t.slug))?.slug ??
    tracks[0]?.slug;
  const menteeView = slug
    ? (
        await api<{ data: MenteeAssignmentsView }>(
          `/admin/mentors/mentees?track=${encodeURIComponent(slug)}`,
        )
      ).data
    : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Mentor</h1>
        <p className="muted mt-1 max-w-2xl text-sm">
          Giao track cho mentor phụ trách. Thành viên thấy tên mentor phụ trách trên trang track.
          Mỗi lần giao hoặc bỏ đều được ghi vào nhật ký; bỏ một track không xoá lịch sử.
        </p>
      </header>

      <section aria-labelledby="mentor-list" className="surface rounded-xl p-5">
        <h2 id="mentor-list" className="font-semibold">
          Mentor đang hoạt động ({mentors.length})
        </h2>
        {mentors.length === 0 ? (
          <p className="muted mt-3 text-sm">
            Chưa có ai có vai trò mentor. Cấp vai trò ở trang{' '}
            <Link href="/admin/members" className="underline">
              Thành viên
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="stack-table w-full text-left text-sm">
              <thead className="muted">
                <tr>
                  <th className="py-1 pr-4 font-medium">Mentor</th>
                  <th className="py-1 pr-4 font-medium">Track phụ trách</th>
                  <th className="py-1 font-medium">Mentee</th>
                </tr>
              </thead>
              <tbody className="divide-[var(--border)] md:divide-y">
                {mentors.map((row) => (
                  <tr key={row.mentor.id} className="align-top">
                    <td className="md:py-3 md:pr-4">
                      <span className="flex items-center gap-2">
                        <Avatar src={row.mentor.avatarUrl} size={28} />
                        <span>
                          <span className="block font-medium">{row.mentor.displayName}</span>
                          <Link
                            href={`/u/${encodeURIComponent(row.mentor.githubLogin)}`}
                            prefetch={false}
                            className="muted text-xs hover:underline"
                          >
                            @{row.mentor.githubLogin}
                          </Link>
                        </span>
                      </span>
                    </td>
                    <td data-label="Track phụ trách" className="md:py-3 md:pr-4">
                      <MentorTracksCell row={row} tracks={tracks} />
                    </td>
                    <td data-label="Mentee" className="whitespace-nowrap md:py-3">
                      {menteeCountLabel(row.activeMentees)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <MenteeAssignments tracks={tracks} view={menteeView} />
    </section>
  );
}
