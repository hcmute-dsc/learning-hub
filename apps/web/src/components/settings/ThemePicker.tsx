'use client';

import { useState } from 'react';
import { THEMES, type Me, type Theme } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

const OPTIONS: Record<Theme, { label: string; icon: string; hint: string }> = {
  system: { label: 'Theo thiết bị', icon: '💻', hint: 'Sáng hay tối theo cài đặt máy' },
  light: { label: 'Sáng', icon: '☀️', hint: 'Luôn dùng nền sáng' },
  dark: { label: 'Tối', icon: '🌙', hint: 'Luôn dùng nền tối' },
};

/**
 * Color scheme → PUT /me/settings. The refresh in useMutation re-renders the root
 * layout, which writes <html data-theme>, so the page switches without a reload.
 */
export function ThemePicker({ theme }: { theme: Theme }) {
  const { run, busy, problem } = useMutation();
  const [selected, setSelected] = useState<Theme>(theme);

  async function choose(next: Theme) {
    if (next === selected) return;
    const previous = selected;
    setSelected(next);
    const res = await run(() => sendJson<Me>('/me/settings', 'PUT', { theme: next }));
    if (!res.ok) setSelected(previous);
  }

  return (
    <fieldset className="mt-4" disabled={busy}>
      <legend className="sr-only">Chế độ màu</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((value) => {
          const option = OPTIONS[value];
          const active = value === selected;
          return (
            <label
              key={value}
              className={`lift press flex cursor-pointer flex-col gap-1 rounded-xl border p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-500 ${
                active
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-[var(--border)] hover:border-brand-500'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value={value}
                checked={active}
                onChange={() => choose(value)}
                className="sr-only"
              />
              <span aria-hidden className="text-2xl">
                {option.icon}
              </span>
              <span className="font-medium">{option.label}</span>
              <span className="muted text-xs">{option.hint}</span>
            </label>
          );
        })}
      </div>
      <ProblemAlert problem={problem} />
    </fieldset>
  );
}
