import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { getMe } from '@/lib/api';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DSC Learning Hub', template: '%s · DSC Learning Hub' },
  description: 'Học đi đôi với hành cùng HCMUTE Developer Student Club',
  icons: { apple: '/brand/apple-touch-icon.png' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-2">
          Bỏ qua tới nội dung
        </a>
        <SiteHeader me={me} />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
