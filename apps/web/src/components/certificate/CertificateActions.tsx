'use client';

import { useState } from 'react';
import { shareUrl } from './certificate';

/**
 * "In / Lưu PDF" and "Sao chép link" under a certificate. Hidden when printing.
 * The browser's print dialog also saves as PDF, so no PDF is generated on the server.
 */
export function CertificateActions({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.origin, code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const button =
    'press rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-brand-500';
  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={button}>
        🖨️ In / Lưu PDF
      </button>
      <button type="button" onClick={copy} className={button} aria-live="polite">
        {copied ? '✅ Đã sao chép' : '🔗 Sao chép link'}
      </button>
    </div>
  );
}
