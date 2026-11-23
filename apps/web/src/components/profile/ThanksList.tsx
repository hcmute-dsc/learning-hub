import Link from 'next/link';
import type { PublicThanks } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { formatDateTime } from '@/lib/format';

/**
 * Thank-you notes from members, on a mentor's profile (learning-hub#41). Only notes the
 * mentor chose to show reach this list; the API leaves the others out.
 */
export function ThanksList({ thanks }: { thanks: PublicThanks[] }) {
  return (
    <section aria-labelledby="thanks-heading">
      <h2 id="thanks-heading" className="text-lg font-semibold">
        Lời cảm ơn từ thành viên ({thanks.length})
      </h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {thanks.map((t) => (
          <li key={t.id} className="surface rounded-2xl p-4 text-sm">
            <blockquote className="whitespace-pre-line">
              <span aria-hidden>💛 </span>
              {t.body}
            </blockquote>
            <p className="muted mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <Avatar src={t.from.avatarUrl} size={18} />
              <Link
                href={`/u/${encodeURIComponent(t.from.githubLogin)}`}
                prefetch={false}
                className="font-medium hover:underline"
              >
                {t.from.displayName}
              </Link>
              <span aria-hidden>·</span>
              <time dateTime={t.createdAt}>{formatDateTime(t.createdAt)}</time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
