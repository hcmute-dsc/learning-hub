'use client';

import { useEffect, useState } from 'react';
import { certificatePath, shareUrl } from './certificate';

/**
 * The full verification URL, so a printed certificate tells the reader where to check
 * it. The origin comes from the browser; the server render shows the path only.
 */
export function VerifyLink({ code }: { code: string }) {
  const [url, setUrl] = useState(certificatePath(code));
  useEffect(() => setUrl(shareUrl(window.location.origin, code)), [code]);
  return (
    <a href={certificatePath(code)} className="hover:underline">
      {url}
    </a>
  );
}
