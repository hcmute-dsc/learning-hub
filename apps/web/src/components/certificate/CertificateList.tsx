import Link from 'next/link';
import type { CertificateView } from '@hub/shared';
import { formatLongDate } from '@/lib/format';
import { certificatePath } from './certificate';

/** Certificates on a member profile: track, date, link to the public page. */
export function CertificateList({ certificates }: { certificates: CertificateView[] }) {
  return (
    <ul className="surface mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl">
      {certificates.map((c) => (
        <li key={c.code}>
          <Link
            href={certificatePath(c.code)}
            className="flex items-center gap-3 px-5 py-4 hover:bg-brand-50/50 dark:hover:bg-white/5"
          >
            <span aria-hidden className="text-2xl">
              🎓
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium break-words">{c.track.title}</span>
              <span className="muted block text-sm">
                Hoàn thành {formatLongDate(c.completedAt)}
              </span>
            </span>
            <span className="text-sm font-medium text-brand-600">Xem chứng nhận →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
