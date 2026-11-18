import type { CertificateView } from '@hub/shared';
import { formatLongDate } from '@/lib/format';
import { contentCommitUrl, contentLabel } from './certificate';
import { VerifyLink } from './VerifyLink';

/**
 * The certificate itself, as shown on /certificates/[code] and printed (A4 landscape,
 * see globals.css @page). Only what the public may see: name, track, dates, commit.
 */
export function CertificateCard({ certificate }: { certificate: CertificateView }) {
  const revoked = certificate.status === 'revoked';
  const commitUrl = contentCommitUrl(certificate.content);
  const label = contentLabel(certificate.content);

  return (
    <article
      aria-labelledby="certificate-title"
      className="certificate surface relative mx-auto max-w-3xl overflow-hidden rounded-2xl border-4 border-double border-brand-500 p-8 text-center sm:p-12"
    >
      {revoked && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          Chứng nhận này đã bị thu hồi
          {certificate.revokedAt ? ` ngày ${formatLongDate(certificate.revokedAt)}` : ''} và không
          còn giá trị.
        </p>
      )}
      <p className="text-sm font-semibold tracking-[0.2em] text-brand-600 uppercase">
        HCMUTE Developer Student Club · Learning Hub
      </p>
      <h1 id="certificate-title" className="mt-4 text-3xl font-bold sm:text-4xl">
        Chứng nhận hoàn thành
      </h1>
      <p className="muted mt-6">Chứng nhận</p>
      <p className="mt-1 text-2xl font-semibold break-words sm:text-3xl">
        {certificate.recipientName}
      </p>
      <p className="muted mt-6">đã hoàn thành toàn bộ bài học và bài tập của lộ trình</p>
      <p className="mt-1 text-xl font-semibold break-words sm:text-2xl">
        {certificate.track.title}
      </p>
      <p className="mt-6">
        ngày <strong>{formatLongDate(certificate.completedAt)}</strong>
      </p>

      <dl className="muted mt-10 grid gap-3 text-left text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Mã chứng nhận</dt>
          <dd className="font-mono break-all">{certificate.code}</dd>
        </div>
        <div>
          <dt className="font-semibold">Phiên bản nội dung</dt>
          <dd className="font-mono break-all">
            {commitUrl ? (
              <a href={commitUrl} rel="noopener noreferrer" className="hover:underline">
                {label}
              </a>
            ) : (
              label
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Ngày cấp</dt>
          <dd>{formatLongDate(certificate.issuedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Xác minh tại</dt>
          <dd className="break-all">
            <VerifyLink code={certificate.code} />
          </dd>
        </div>
      </dl>
    </article>
  );
}
