import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getMe } from '@/lib/api';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DSC Learning Hub', template: '%s · DSC Learning Hub' },
  description: 'Học bằng cách làm cùng HCMUTE Developer Student Club',
};

const NAV = [
  { href: '/dashboard', label: 'Bảng điều khiển' },
  { href: '/tracks', label: 'Lộ trình' },
];

export default async function RootLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  return (
    <html lang="vi">
      <body className="min-h-screen font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
          Bỏ qua tới nội dung
        </a>
        <header className="surface border-x-0 border-t-0">
          <nav
            aria-label="Chính"
            className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm"
          >
            <Link href="/" className="font-mono text-base font-bold">
              {'{dsc}'} <span className="font-sans">learning hub</span>
            </Link>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="muted hover:text-[var(--text)]">
                {n.label}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-3">
              {me ? (
                <>
                  <span className="muted hidden sm:inline">@{me.githubLogin}</span>
                  <form action="/logout" method="post">
                    <button className="rounded-md border border-[var(--border)] px-3 py-1.5">
                      Đăng xuất
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="muted mx-auto max-w-6xl px-4 pb-8 text-xs">
          HCMUTE Developer Student Club ·{' '}
          <a className="underline" href="https://hcmute-dsc.io.vn">
            Website CLB
          </a>{' '}
          ·{' '}
          <a className="underline" href="https://github.com/hcmute-dsc">
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
