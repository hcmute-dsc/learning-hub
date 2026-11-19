'use client';

import Link from 'next/link';
import type { MyCertificate } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { formatLongDate } from '@/lib/format';
import { useMutation } from '@/lib/use-mutation';
import { certificatePath } from './certificate';

/** One of the member's certificates in /settings, with "show on profile" on or off. */
export function CertificateVisibility({ certificate }: { certificate: MyCertificate }) {
  const { run, busy, problem } = useMutation();
  const revoked = certificate.status === 'revoked';
  const id = `cert-visible-${certificate.code}`;

  function toggle(visible: boolean) {
    return run(() =>
      sendJson(`/me/certificates/${encodeURIComponent(certificate.code)}`, 'PATCH', {
        hidden: !visible,
      }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={certificatePath(certificate.code)}
          className="font-medium break-words hover:text-brand-600 hover:underline"
        >
          {certificate.track.title}
        </Link>
        <p className="muted text-sm">
          Hoàn thành {formatLongDate(certificate.completedAt)}
          {revoked && ' · đã bị admin thu hồi'}
        </p>
        <ProblemAlert problem={problem} />
      </div>
      {!revoked && (
        <label htmlFor={id} className="flex items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            checked={!certificate.hidden}
            disabled={busy}
            aria-busy={busy}
            onChange={(e) => toggle(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          Hiện trên hồ sơ
        </label>
      )}
    </div>
  );
}
