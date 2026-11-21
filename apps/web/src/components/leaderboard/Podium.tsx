import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { LeaderboardRow } from '@hub/shared';
import { MemberAvatar } from './MemberAvatar';
import { MEDAL_TONE, medalFor, podiumOrder } from './board';

/**
 * Top 3 as a podium (learning-hub#88): 2nd, 1st, 3rd, each on a step in gold, silver or
 * bronze, with the round medal style of the badges (#75). Steps rise in, the medals pop;
 * `prefers-reduced-motion` turns both off (globals.css). Styles: `.lb-*` in globals.css.
 */
export function Podium({ rows, meId }: { rows: LeaderboardRow[]; meId: string | null }) {
  return (
    <ol className="lb-podium" aria-label="Top 3">
      {podiumOrder(rows).map((row, i) => {
        const medal = medalFor(row.rank) ?? 'bronze';
        const tone = MEDAL_TONE[medal];
        const style = {
          '--badge-from': tone.from,
          '--badge-to': tone.to,
          '--i': i,
        } as CSSProperties;
        return (
          <li
            key={row.user.id}
            className="lb-place"
            data-medal={medal}
            data-me={row.user.id === meId ? '' : undefined}
            style={style}
          >
            <div className="lb-person">
              <span className="lb-avatar-ring">
                <MemberAvatar
                  src={row.user.avatarUrl}
                  name={row.user.displayName}
                  size={row.rank === 1 ? 84 : 68}
                />
                <span aria-hidden className="badge-medal lb-medal" data-size="sm">
                  <span className="badge-medal-icon">
                    {medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : '🥉'}
                  </span>
                </span>
              </span>
              <Link
                href={`/u/${row.user.githubLogin}`}
                className="mt-2 line-clamp-2 max-w-full text-center text-sm font-semibold break-words hover:underline sm:text-base"
              >
                {row.user.displayName}
              </Link>
              <span className="muted text-xs sm:text-sm">
                <span className="font-semibold text-[var(--text)]">{row.score}</span> điểm ·{' '}
                {row.completed} bài
              </span>
            </div>
            <div className="lb-step">
              <span className="sr-only">{tone.label}: </span>
              {row.rank}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
