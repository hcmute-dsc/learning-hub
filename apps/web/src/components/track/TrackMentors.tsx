import Link from 'next/link';
import type { PersonRef } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';

/**
 * "Mentor phụ trách" on the track page (learning-hub#120): who looks after this track, set
 * by an admin on /admin/mentors. Hidden while no mentor is assigned.
 */
export function TrackMentors({ mentors }: { mentors: PersonRef[] }) {
  if (mentors.length === 0) return null;
  return (
    <section aria-labelledby="track-mentors-title" className="surface rounded-xl p-4 sm:p-5">
      <h2 id="track-mentors-title" className="font-semibold">
        Mentor phụ trách
      </h2>
      <p className="muted mt-1 text-sm">Những mentor được giao theo dõi lộ trình này.</p>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {mentors.map((m) => (
          <li key={m.id}>
            <Link
              href={`/u/${encodeURIComponent(m.githubLogin)}`}
              prefetch={false}
              className="flex items-center gap-2 hover:underline"
            >
              <Avatar src={m.avatarUrl} size={28} />
              <span className="font-medium">{m.displayName}</span>
              <span className="muted text-sm">@{m.githubLogin}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
