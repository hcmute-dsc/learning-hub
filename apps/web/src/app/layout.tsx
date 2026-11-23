import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { getMe } from '@/lib/api';
import { SITE_NAME } from '@/lib/club';
import './globals.css';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: 'Học đi đôi với hành cùng HCMUTE Developer Student Club',
  icons: { apple: '/brand/apple-touch-icon.png' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  return (
    // "system" leaves data-theme out so the device decides (see @custom-variant dark in globals.css).
    <html lang="vi" data-theme={me && me.theme !== 'system' ? me.theme : undefined}>
      <body className="flex min-h-screen flex-col overflow-x-clip font-sans antialiased">
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
