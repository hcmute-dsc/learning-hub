import { MENTEE_INACTIVE_DAYS, type ReviewQueueStats } from '@hub/shared';
import { formatWaiting } from './review-form';

/**
 * Mentor dashboard numbers above the queue (US-07): counted by the API for the current
 * filter. The inactive-mentees tile only appears once the mentor has mentees (E8).
 */
export function QueueStats({ stats }: { stats: ReviewQueueStats }) {
  const tiles: { label: string; value: string; warn?: boolean }[] = [
    { label: 'Đang chờ', value: String(stats.waiting) },
    { label: 'Chưa ai nhận', value: String(stats.waiting - stats.claimed) },
    { label: 'Quá hạn', value: String(stats.overTarget), warn: stats.overTarget > 0 },
    {
      label: 'Chờ lâu nhất',
      value: stats.oldestHoursWaiting === null ? '—' : formatWaiting(stats.oldestHoursWaiting),
    },
  ];
  if (stats.inactiveMentees !== null) {
    tiles.push({
      label: `Mentee không hoạt động ≥ ${MENTEE_INACTIVE_DAYS} ngày`,
      value: String(stats.inactiveMentees),
      warn: stats.inactiveMentees > 0,
    });
  }

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="surface rounded-xl px-4 py-3">
          <dt className="muted text-xs">{t.label}</dt>
          <dd
            className={`mt-1 text-xl font-semibold ${
              t.warn ? 'text-orange-700 dark:text-orange-300' : ''
            }`}
          >
            {t.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
