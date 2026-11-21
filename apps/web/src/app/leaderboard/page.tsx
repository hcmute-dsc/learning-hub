import type { Metadata } from 'next';
import Link from 'next/link';
import type { Leaderboard, LeaderboardRow } from '@hub/shared';
import { Avatar } from '@/components/ui/Avatar';
import { apiOrNotFound } from '@/lib/api';

export const metadata: Metadata = { title: 'Bảng xếp hạng' };

/**
 * Opt-in leaderboard of the term (E14, DECISIONS ADR-08, FRONTEND-DESIGN §13): top 10 and
 * the viewer's own rank. Only members who opted in appear; no times, no speed, no
 * all-time tab, and no "loser" styling.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { term } = await searchParams;
  const query = term ? `?term=${encodeURIComponent(term)}` : '';
  const { data: board } = await apiOrNotFound<{ data: Leaderboard }>(`/leaderboard${query}`);
  const meInTop = board.me && board.top.some((r) => r.user.id === board.me?.user.id);

  return (
    <div className="motion-fade-up mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Bảng xếp hạng</h1>
        <p className="muted mt-1">
          {board.term.label}. Tính theo số bài hoàn thành trong kỳ: bài chấm tự động hoặc được
          mentor duyệt được {board.weights.graded} điểm, bài tự đánh giá được{' '}
          {board.weights.selfCheck} điểm. Không tính tốc độ. Sang kỳ mới bảng bắt đầu lại.
        </p>
        <nav aria-label="Chọn học kỳ" className="mt-3 flex gap-4 text-sm font-medium">
          {board.term.previousId && (
            <Link
              href={`/leaderboard?term=${board.term.previousId}`}
              className="text-brand-600 hover:underline"
            >
              ← Kỳ trước
            </Link>
          )}
          {board.term.nextId && (
            <Link
              href={`/leaderboard?term=${board.term.nextId}`}
              className="text-brand-600 hover:underline"
            >
              Kỳ sau →
            </Link>
          )}
        </nav>
      </header>

      {!board.optedIn && (
        <section className="surface rounded-2xl border-brand-500 p-5 text-sm">
          <p className="font-medium">Bạn chưa có tên trên bảng.</p>
          <p className="muted mt-1">
            Bảng chỉ hiện thành viên tự bật. Bật ở{' '}
            <Link href="/settings" className="text-brand-600 hover:underline">
              Cài đặt
            </Link>{' '}
            nếu bạn muốn, tắt lúc nào cũng được.
          </p>
        </section>
      )}

      <section aria-labelledby="top-heading" className="surface rounded-2xl p-5 sm:p-6">
        <h2 id="top-heading" className="text-lg font-semibold">
          Top 10
        </h2>
        {board.top.length === 0 ? (
          <p className="muted mt-3 text-sm italic">Kỳ này chưa có ai trên bảng.</p>
        ) : (
          <ol className="mt-2 divide-y divide-[var(--border)]">
            {board.top.map((row) => (
              <Row key={row.user.id} row={row} highlight={row.user.id === board.me?.user.id} />
            ))}
          </ol>
        )}
      </section>

      {board.me && !meInTop && (
        <section aria-labelledby="me-heading" className="surface rounded-2xl p-5 sm:p-6">
          <h2 id="me-heading" className="text-lg font-semibold">
            Hạng của bạn
          </h2>
          <ol className="mt-2">
            <Row row={board.me} highlight />
          </ol>
        </section>
      )}

      <p className="muted text-sm">
        Muốn xem mình đã học tới đâu?{' '}
        <Link href="/dashboard" className="text-brand-600 hover:underline">
          Mở bảng điều khiển
        </Link>
        .
      </p>
    </div>
  );
}

function Row({ row, highlight }: { row: LeaderboardRow; highlight: boolean }) {
  return (
    <li
      className={`flex items-center gap-3 py-2.5 ${highlight ? 'font-semibold text-brand-600' : ''}`}
    >
      <span className="w-8 text-right tabular-nums">{row.rank}</span>
      <Avatar src={row.user.avatarUrl} size={32} />
      <Link href={`/u/${row.user.githubLogin}`} className="min-w-0 flex-1 truncate hover:underline">
        {row.user.displayName}
      </Link>
      <span className="text-sm tabular-nums" title={`${row.completed} bài hoàn thành`}>
        {row.score} điểm
      </span>
    </li>
  );
}
