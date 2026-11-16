'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="surface mx-auto max-w-md rounded-2xl p-8 text-center">
      <h1 className="text-xl font-bold">Có lỗi xảy ra</h1>
      <p className="muted mt-2 text-sm">
        Thử lại sau ít phút. Nếu vẫn lỗi, gửi mã này cho Ban kỹ thuật.
      </p>
      {error.digest && <code className="mt-2 block text-xs">{error.digest}</code>}
      <button onClick={reset} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-white">
        Thử lại
      </button>
    </section>
  );
}
