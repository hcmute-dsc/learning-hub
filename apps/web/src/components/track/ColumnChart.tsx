'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { niceTicks } from './track-stats-format';

/**
 * A small column chart for /tracks/:slug/stats (learning-hub#126), drawn with plain divs: no
 * chart library, text stays crisp at any width, and the theme colours come from CSS
 * variables (`--chart-1`, `--chart-2` in globals.css).
 *
 * - One or two series side by side per column, on one count axis from 0 with round ticks.
 * - Mouse: hovering a column shows a tooltip with every series of that column. Touch: a tap
 *   shows it, another tap hides it (touch has no hover, so leaving is ignored).
 * - Keyboard: the chart is ONE tab stop (roving tabindex); ← → Home End move between columns
 *   and the focused column shows its tooltip.
 * - Screen readers: the columns are a labelled list, each item naming the column and every
 *   value. That is the only text version, so nothing is read twice.
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
  /** longer name in the tooltip and for screen readers ("Tuần 23/11 – 29/11") */
  title: string;
  /** one value per series, in series order */
  values: number[];
}

interface Props {
  /** what the chart shows, for screen readers (the section heading says it for everyone) */
  label: string;
  series: ChartSeries[];
  columns: ChartColumn[];
  /** print each value above its column (only for a few columns) */
  valueLabels?: boolean;
}

const PLOT_HEIGHT = 'h-44';

export function ColumnChart({ label, series, columns, valueLabels = false }: Props) {
  const [active, setActive] = useState<number | null>(null);
  // The column that holds the single tab stop: the latest one until the reader moves.
  const [focusIndex, setFocusIndex] = useState(columns.length - 1);
  const items = useRef<(HTMLLIElement | null)[]>([]);
  const pointer = useRef<string>('mouse');
  const wasOpen = useRef(false);

  const ticks = niceTicks(Math.max(0, ...columns.flatMap((c) => c.values)));
  const top = ticks[ticks.length - 1];
  const at = (value: number) => `${(value / top) * 100}%`;
  const count = columns.length;
  // On a phone, 12 week labels do not fit: keep every other one, the latest included.
  const thinLabels = count > 8;

  function moveTo(i: number) {
    setFocusIndex(i);
    setActive(i);
    items.current[i]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const next = {
      ArrowRight: Math.min(count - 1, focusIndex + 1),
      ArrowLeft: Math.max(0, focusIndex - 1),
      Home: 0,
      End: count - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    moveTo(next);
  }

  const isMouse = (e: PointerEvent) => e.pointerType === 'mouse';

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
          className={`muted relative min-w-6 shrink-0 text-right text-xs tabular-nums ${PLOT_HEIGHT}`}
        >
          {/* the widest label sets the width; the others are placed on their gridline */}
          <span className="invisible block leading-none">{top.toLocaleString('vi-VN')}</span>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 leading-none"
              style={{ bottom: at(t) }}
            >
              {t.toLocaleString('vi-VN')}
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

            <ul aria-label={label} className="absolute inset-0 flex" onKeyDown={onKeyDown}>
              {columns.map((c, i) => (
                <li
                  key={c.key}
                  ref={(el) => {
                    items.current[i] = el;
                  }}
                  tabIndex={i === focusIndex ? 0 : -1}
                  aria-label={`${c.title}: ${series.map((s, j) => `${s.label} ${c.values[j]}`).join(', ')}`}
                  onPointerDown={(e) => {
                    pointer.current = e.pointerType;
                    // read before the tap focuses the column (focus opens the tooltip)
                    wasOpen.current = active === i;
                  }}
                  onPointerEnter={(e) => isMouse(e) && setActive(i)}
                  onPointerLeave={(e) => isMouse(e) && setActive((a) => (a === i ? null : a))}
                  onClick={() => {
                    // a tap toggles; a mouse already shows the tooltip on hover
                    if (pointer.current !== 'mouse') setActive(wasOpen.current ? null : i);
                    setFocusIndex(i);
                  }}
                  onFocus={() => {
                    setFocusIndex(i);
                    setActive(i);
                  }}
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
                          {v.toLocaleString('vi-VN')}
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
                    <strong className="tabular-nums">
                      {columns[active].values[j].toLocaleString('vi-VN')}
                    </strong>
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
    </figure>
  );
}
