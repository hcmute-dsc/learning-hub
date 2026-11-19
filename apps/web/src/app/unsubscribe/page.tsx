import type { Metadata } from 'next';
import { UnsubscribeButton } from '@/components/notifications/UnsubscribeButton';

export const metadata: Metadata = { title: 'Tắt email tóm tắt', robots: { index: false } };

/**
 * Landing page of the digest's unsubscribe link (learning-hub#49). Works without signing
 * in. It asks for one click instead of unsubscribing on load, because mail scanners open
 * links in emails automatically.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = typeof token === 'string' ? token : '';
  return (
    <section className="surface mx-auto max-w-md rounded-2xl p-8 text-center">
      <p className="text-4xl" aria-hidden>
        ✉️
      </p>
      <h1 className="mt-2 text-2xl font-bold">Tắt email tóm tắt</h1>
      {value ? (
        <UnsubscribeButton token={value} />
      ) : (
        <p className="muted mt-2 text-sm">
          Link thiếu mã. Hãy mở lại link trong email, hoặc tắt trong phần Cài đặt sau khi đăng nhập.
        </p>
      )}
    </section>
  );
}
