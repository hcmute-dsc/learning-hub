import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Đang chờ duyệt' };

export default function PendingPage() {
  return (
    <section className="surface mx-auto max-w-md rounded-2xl p-8 text-center">
      <p className="text-4xl" aria-hidden>
        ⏳
      </p>
      <h1 className="mt-2 text-2xl font-bold">Tài khoản đang chờ duyệt</h1>
      <p className="muted mt-2 text-sm">
        Bạn chưa thuộc org GitHub của CLB, nên Ban chủ nhiệm hoặc mentor cần duyệt tài khoản trước.
        Hãy nhắn trên Discord của CLB để được duyệt nhanh hơn.
      </p>
    </section>
  );
}
