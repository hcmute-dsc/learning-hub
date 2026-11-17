'use client';

import { useState } from 'react';
import { BIO_MAX, DISPLAY_NAME_MAX, type Me, type ProfileUpdateInput } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

const inputClass =
  'mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 focus:border-brand-500';

/** Name and bio → PATCH /me/profile. GitHub sign-in never overwrites them. */
export function ProfileForm({ displayName, bio }: { displayName: string; bio: string | null }) {
  const { run, busy, problem } = useMutation();
  const [name, setName] = useState(displayName);
  const [about, setAbout] = useState(bio ?? '');
  const [saved, setSaved] = useState(false);

  const changed = name.trim() !== displayName || about.trim() !== (bio ?? '');

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    const body: ProfileUpdateInput = { displayName: name, bio: about };
    const res = await run(() => sendJson<Me>('/me/profile', 'PATCH', body));
    if (res.ok) setSaved(true);
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-4">
      <div>
        <label htmlFor="display-name" className="font-medium">
          Tên hiển thị
        </label>
        <input
          id="display-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="bio" className="font-medium">
          Giới thiệu ngắn
        </label>
        <textarea
          id="bio"
          value={about}
          onChange={(e) => {
            setAbout(e.target.value);
            setSaved(false);
          }}
          maxLength={BIO_MAX}
          rows={3}
          placeholder="Ví dụ: Sinh viên năm 2 ngành CNTT, đang học SQL và thích làm web."
          className={inputClass}
        />
        <p className="muted mt-1 text-right text-xs">
          {about.length}/{BIO_MAX}
        </p>
      </div>
      <ProblemAlert problem={problem} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !changed || name.trim() === ''}
          aria-busy={busy}
          className="press rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-300">
          {saved && !busy ? '✓ Đã lưu' : ''}
        </p>
      </div>
    </form>
  );
}
