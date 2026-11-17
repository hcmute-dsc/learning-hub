import type { ActivityDay } from '@hub/shared';
import { activityLevel, formatDay, toWeeks } from './profile';

/** Shades from "nothing" to "a lot"; orange like the rest of the hub. */
const LEVEL_CLASS = [
  'bg-[var(--border)]',
  'bg-brand-100 dark:bg-brand-700/60',
  'bg-brand-500/60',
  'bg-brand-500',
  'bg-brand-700 dark:bg-brand-100',
] as const;

const WEEKDAYS = ['T2', '', 'T4', '', 'T6', '', ''];

/**
 * GitHub-style grid: one column per week (Monday on top), one square per day.
 * The numbers are also in each square's title and in the sr-only summary, so the
 * grid is not the only way to read them.
 */
export function ActivityGrid({ days }: { days: ActivityDay[] }) {
  const weeks = toWeeks(days);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;
  return (
    <figure>
      <div className="overflow-x-auto pb-1" tabIndex={0} aria-label="Lịch hoạt động">
        <div className="flex w-max gap-[3px]" aria-hidden>
          <div className="muted mr-1 grid grid-rows-7 gap-[3px] text-[10px] leading-3">
            {WEEKDAYS.map((label, i) => (
              <span key={i} className="h-3">
                {label}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].date} className="grid grid-rows-7 gap-[3px]">
              {week.map((day, i) => (
                <span
                  key={day.date}
                  title={`${formatDay(day.date)}: ${day.count} hoạt động`}
                  className={`motion-pop size-3 rounded-[3px] ${LEVEL_CLASS[activityLevel(day.count)]}`}
                  style={{ animationDelay: `${Math.min(i * 20, 120)}ms` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="muted mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>
          {total} hoạt động trong {active} ngày ({weeks.length} tuần gần đây)
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          Ít
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={`size-3 rounded-[3px] ${cls}`} />
          ))}
          Nhiều
        </span>
      </figcaption>
    </figure>
  );
}
