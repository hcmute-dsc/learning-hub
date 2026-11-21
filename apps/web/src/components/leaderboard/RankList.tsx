import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LeaderboardRow } from '@hub/shared';
import { MemberAvatar } from './MemberAvatar';

/** Ranks after the podium (4–10), and the viewer's own row (learning-hub#88). */
export function RankList({
  rows,
  meId,
  start = 0,
}: {
  rows: LeaderboardRow[];
  meId: string | null;
  /** stagger offset, so the list animates after the podium */
  start?: number;
}) {
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => (
        <li
          key={row.user.id}
          className="lb-row motion-fade-up"
          data-me={row.user.id === meId ? '' : undefined}
          style={{ '--i': start + i } as CSSProperties}
        >
          <span className="w-8 shrink-0 text-center font-semibold tabular-nums">{row.rank}</span>
          <MemberAvatar src={row.user.avatarUrl} name={row.user.displayName} size={36} />
          <Link
            href={`/u/${row.user.githubLogin}`}
            className="min-w-0 flex-1 truncate font-medium hover:underline"
          >
            {row.user.displayName}
          </Link>
          <span className="muted hidden text-sm tabular-nums sm:inline">{row.completed} bài</span>
          <span className="w-20 shrink-0 text-right font-semibold tabular-nums">
            {row.score} điểm
          </span>
        </li>
      ))}
    </ol>
  );
}
