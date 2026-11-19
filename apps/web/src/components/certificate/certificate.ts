import { CERTIFICATE_CODE, type CertificateView } from '@hub/shared';

/** Pure helpers for certificate pages (tested in certificate.test.ts). */

/** Path of the public verification page, the link members share. */
export const certificatePath = (code: string) => `/certificates/${code}`;

/** A malformed code is a 404 without calling the API. */
export const isCertificateCode = (code: string) => CERTIFICATE_CODE.test(code);

/** GitHub page of the content commit the member finished, or null for a non-GitHub source. */
export function contentCommitUrl(content: CertificateView['content']): string | null {
  if (!/^[\w.-]+\/[\w.-]+$/.test(content.repo) || !/^[0-9a-f]{40}$/.test(content.commitSha)) {
    return null;
  }
  return `https://github.com/${content.repo}/commit/${content.commitSha}`;
}

/** Full URL to share, from the site origin (e.g. https://learn.hcmute-dsc.io.vn). */
export function shareUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}${certificatePath(code)}`;
}

/**
 * "owner/repo@abc1234" for the content line. A local folder (development only) shows
 * no path, so a machine's folder layout never ends up on a printed certificate.
 */
export function contentLabel(content: CertificateView['content']): string {
  const repo = content.repo.startsWith('local:') ? 'local' : content.repo;
  return `${repo}@${content.commitSha.slice(0, 7)}`;
}
