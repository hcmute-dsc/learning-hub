'use client';

import { useState } from 'react';
import { niceTicks } from './track-stats-format';

/**
 * A small column chart for /tracks/:slug/stats (learning-hub#126), drawn with plain divs: no
 * chart library, text stays crisp at any width, and the theme colours come from CSS
 * variables (`--chart-1`, `--chart-2` in globals.css).
 *
 * - One or two series side by side per column, on one count axis from 0 with round ticks.
 * - Hover or keyboard focus on a column shows a tooltip with every series of that column.
 * - Screen readers get each column as a labelled list item and the same numbers as a table.
 */

export interface ChartSeries {
  label: string;
  /** a CSS variable holding the colour, e.g. '--chart-2' */
  color: string;
}

export interface ChartColumn {
  key: string;
  /** short label under the column ("23/11") */
  label: string;
  /** longer name in the tooltip and the table ("Tuần 23/11 – 29/11") */
  title: string;
  /** one value per series, in series order */
  values: number[];
}

interface Props {
  /** what the chart shows, for screen readers (the section heading says it for everyone) */
  label: string;
  series: ChartSeries[];
  columns: ChartColumn[];
  /** header of the first table column ("Tuần", "Tiến độ") */
  columnHeader: string;
  /** print each value above its column (only for a few columns) */
  valueLabels?: boolean;
}

const PLOT_HEIGHT = 'h-44';

export function ColumnChart({ label, series, columns, columnHeader, valueLabels = false }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(0, ...columns.flatMap((c) => c.values)));
  const top = ticks[ticks.length - 1];
  const at = (value: number) => `${(value / top) * 100}%`;
  const count = columns.length;
  // On a phone, 12 week labels do not fit: keep every other one, the latest included.
  const thinLabels = count > 8;

  return (
    <figure className="space-y-3">
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-hidden>
          {series.map((s) => (
            <li key={s.label} className="muted flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: `var(${s.color})` }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div className={`flex gap-2 ${valueLabels ? 'pt-5' : 'pt-2'}`}>
        <div
          aria-hidden
          className={`muted relative w-7 shrink-0 text-right text-xs tabular-nums ${PLOT_HEIGHT}`}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: at(t) }}
            >
              {t}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className={`relative ${PLOT_HEIGHT}`}>
            {ticks.map((t) => (
              <div
                key={t}
                aria-hidden
                className="absolute inset-x-0 border-t border-[var(--border)]"
                style={{ bottom: at(t) }}
              />
            ))}

            <ul aria-label={label} className="absolute inset-0 flex">
              {columns.map((c, i) => (
                <li
                  key={c.key}
                  tabIndex={0}
                  aria-label={`${c.title}: ${series.map((s, j) => `${s.label} ${c.values[j]}`).join(', ')}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                  className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-sm px-[2px] outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${active === i ? 'bg-black/5 dark:bg-white/10' : ''}`}
                >
                  {c.values.map((v, j) => (
                    <div
                      key={series[j].label}
                      aria-hidden
                      className="relative w-full max-w-6 rounded-t"
                      style={{ height: at(v), background: `var(${series[j].color})` }}
                    >
                      {valueLabels && v > 0 && (
                        <span className="absolute inset-x-0 bottom-full mb-0.5 text-center text-xs font-medium tabular-nums">
                          {v}
                        </span>
                      )}
                    </div>
                  ))}
                </li>
              ))}
            </ul>

            {active !== null && (
              <div
                aria-hidden
                className="surface pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-lg px-3 py-2 text-xs shadow-lg"
                style={{
                  left: `${((active + 0.5) / count) * 100}%`,
                  // keep the box inside the card near both ends
                  transform: `translateX(${active < count / 4 ? '-15%' : active >= (count * 3) / 4 ? '-85%' : '-50%'})`,
                }}
              >
                <p className="muted mb-1">{columns[active].title}</p>
                {series.map((s, j) => (
                  <p key={s.label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-0.5 w-3 rounded-full"
                      style={{ background: `var(${s.color})` }}
                    />
                    <strong className="tabular-nums">{columns[active].values[j]}</strong>
                    <span className="muted">{s.label}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          <div aria-hidden className="muted mt-1.5 flex text-xs tabular-nums">
            {columns.map((c, i) => (
              <span
                key={c.key}
                className={`min-w-0 flex-1 text-center ${thinLabels && (count - 1 - i) % 2 ? 'invisible sm:visible' : ''}`}
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{columnHeader}</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row">{c.title}</th>
              {c.values.map((v, j) => (
                <td key={series[j].label}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
