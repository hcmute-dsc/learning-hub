import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Đăng nhập' };

const ERRORS: Record<string, string> = {
  state: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <section className="surface mx-auto max-w-md rounded-2xl p-8">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <p className="muted mt-2 text-sm">
        Learning Hub dùng tài khoản GitHub vì bài tập được nộp qua GitHub. Chúng mình chỉ đọc hồ sơ
        công khai, email và việc bạn có thuộc org <code>hcmute-dsc</code> hay không.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {ERRORS[error] ?? 'Không đăng nhập được. Vui lòng thử lại.'}
        </p>
      )}
      <a
        href="/api/v1/auth/github/login"
        className="mt-6 block rounded-lg bg-[#24292f] px-4 py-2.5 text-center font-medium text-white hover:bg-black"
      >
        Đăng nhập với GitHub
      </a>
      <p className="muted mt-4 text-xs">
        Chưa có GitHub? Tạo tài khoản miễn phí tại github.com rồi quay lại. Thành viên mới sẽ chờ
        Ban chủ nhiệm duyệt.
      </p>
    </section>
  );
}
