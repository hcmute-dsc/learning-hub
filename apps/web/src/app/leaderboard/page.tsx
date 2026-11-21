import type { Metadata } from 'next';
import Link from 'next/link';
import type { Leaderboard, Paginated, TrackSummary } from '@hub/shared';
import { BoardFilters } from '@/components/leaderboard/BoardFilters';
import { Podium } from '@/components/leaderboard/Podium';
import { RankList } from '@/components/leaderboard/RankList';
import { ShareButtons } from '@/components/leaderboard/ShareButtons';
import { boardSearch, parseBoardQuery, splitPodium } from '@/components/leaderboard/board';
import { api, apiOrNotFound } from '@/lib/api';

export const metadata: Metadata = { title: 'Bảng xếp hạng' };

/**
 * Opt-in leaderboard (E14, DECISIONS ADR-08, FRONTEND-DESIGN §13), redesigned in
 * learning-hub#88: a term or a week, optionally one track; top 3 on a podium, ranks
 * 4–10 below, the viewer's own rank, and a PNG to share. Only members who opted in
 * appear; no times, no speed, no all-time board, no "loser" styling.
 */
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseBoardQuery(await searchParams);
  const search = boardSearch(query);
  const [{ data: board }, tracks] = await Promise.all([
    apiOrNotFound<{ data: Leaderboard }>(`/leaderboard${search ? `?${search}` : ''}`),
    api<Paginated<TrackSummary>>('/tracks?pageSize=100').then((p) => p.data),
  ]);
  const { podium, rest } = splitPodium(board.top);
  const meId = board.me?.user.id ?? null;
  const meShown = board.me && board.top.some((r) => r.user.id === meId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="motion-fade-up space-y-1">
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
          🏆 Bảng xếp hạng
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">
          {board.range.label}
          {board.track && <span className="muted font-medium"> · {board.track.title}</span>}
        </h1>
        <p className="muted text-sm">
          Bài chấm tự động hoặc được mentor duyệt: {board.weights.graded} điểm. Bài tự đánh giá:{' '}
          {board.weights.selfCheck} điểm. Không tính tốc độ. Chỉ có thành viên tự bật.
        </p>
      </header>

      <BoardFilters
        query={query}
        range={board.range}
        tracks={tracks.map((t) => ({ slug: t.slug, title: t.title }))}
      />

      {!board.optedIn && (
        <section className="surface motion-fade-up rounded-2xl p-4 text-sm">
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

      <section aria-labelledby="board-heading" className="surface rounded-2xl p-4 sm:p-6">
        <h2 id="board-heading" className="sr-only">
          Top 10
        </h2>
        {board.top.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-4xl" aria-hidden>
              🌱
            </p>
            <p className="muted mt-2 text-sm">
              {board.range.period === 'week' ? 'Tuần' : 'Kỳ'} này chưa có ai trên bảng.
            </p>
          </div>
        ) : (
          <>
            <Podium rows={podium} meId={meId} />
            {rest.length > 0 && (
              <div className="mt-6">
                <RankList rows={rest} meId={meId} start={3} />
              </div>
            )}
          </>
        )}

        {board.me && !meShown && (
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <h3 className="muted mb-2 text-xs font-semibold tracking-wide uppercase">
              Hạng của bạn
            </h3>
            <RankList rows={[board.me]} meId={meId} />
          </div>
        )}
      </section>

      <section className="surface rounded-2xl p-4 sm:p-6">
        <ShareButtons query={query} rangeId={board.range.id} disabled={board.top.length === 0} />
      </section>

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
