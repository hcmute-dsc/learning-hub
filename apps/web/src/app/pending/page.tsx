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
        Chưa có email nào trên tài khoản GitHub của bạn khớp với danh sách thành viên CLB. Nếu bạn
        đăng ký CLB bằng email khác (ví dụ email trường), hãy thêm email đó vào GitHub (Settings →
        Emails), xác minh, rồi đăng nhập lại. Hoặc nhắn Ban chủ nhiệm trên Discord để được duyệt.
      </p>
    </section>
  );
}
