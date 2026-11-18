import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { CertificateView } from '@hub/shared';
import { CertificateActions } from '@/components/certificate/CertificateActions';
import { CertificateCard } from '@/components/certificate/CertificateCard';
import { isCertificateCode } from '@/components/certificate/certificate';
import { apiOrNotFound } from '@/lib/api';

type Params = { params: Promise<{ code: string }> };

/** One API call per request, shared by the metadata and the page. */
const loadCertificate = cache(async (code: string): Promise<CertificateView> => {
  if (!isCertificateCode(code)) notFound();
  return (await apiOrNotFound<{ data: CertificateView }>(`/certificates/${code}`)).data;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const certificate = await loadCertificate(code);
  return {
    title: `Chứng nhận ${certificate.track.title}`,
    // A member's name should not end up in search results; the link is shared on purpose.
    robots: { index: false, follow: false },
  };
}

/**
 * Public certificate verification page (PRD F19): anyone with the link, no sign-in.
 * Print-friendly: the site header and footer are hidden by globals.css @media print.
 */
export default async function CertificatePage({ params }: Params) {
  const { code } = await params;
  const certificate = await loadCertificate(code);
  return (
    <div className="space-y-6">
      <CertificateCard certificate={certificate} />
      {certificate.status === 'valid' && <CertificateActions code={certificate.code} />}
    </div>
  );
}
