import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="py-12 text-center">
      <p className="font-mono text-sm text-brand-600">HCMUTE DSC · Learning Hub</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Học bằng cách làm.</h1>
      <p className="muted mx-auto mt-4 max-w-2xl text-lg">
        Chọn một lộ trình, làm bài tập nhỏ, nộp qua GitHub và nhận góp ý từ anh chị mentor trong
        CLB.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/tracks"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
        >
          Xem lộ trình
        </Link>
        <a
          href="https://github.com/hcmute-dsc"
          className="rounded-lg border border-[var(--border)] px-5 py-2.5 font-medium"
        >
          Đóng góp nội dung
        </a>
      </div>
      <ol className="mx-auto mt-14 grid max-w-4xl gap-4 text-left sm:grid-cols-3">
        {[
          ['1. Học', 'Bài ngắn, có mục tiêu rõ, đọc tốt trên điện thoại.'],
          ['2. Làm', 'Quiz, tự kiểm tra hoặc bài code nộp bằng pull request.'],
          ['3. Nhận góp ý', 'Chấm tự động và review từ mentor.'],
        ].map(([title, body]) => (
          <li key={title} className="surface rounded-xl p-5">
            <h2 className="font-semibold">{title}</h2>
            <p className="muted mt-1 text-sm">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
