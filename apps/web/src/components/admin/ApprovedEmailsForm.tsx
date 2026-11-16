'use client';

import { useMemo, useState } from 'react';
import {
  MAX_APPROVED_EMAILS_PER_REQUEST,
  type ApprovedEmailsUpdateInput,
  type ApprovedEmailsUpdateResult,
} from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { parseEmailList } from './email-list';

type Mode = 'append' | 'replace';

/**
 * Paste member emails → PUT /admin/approved-emails (SECURITY §1, decided 16/11/2026).
 * `replace` swaps the whole list, so it asks for confirmation first.
 */
export function ApprovedEmailsForm({ currentTotal }: { currentTotal: number }) {
  const { run, busy, problem } = useMutation();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('append');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<ApprovedEmailsUpdateResult | null>(null);

  const parsed = useMemo(() => parseEmailList(text), [text]);
  const tooMany = parsed.valid.length > MAX_APPROVED_EMAILS_PER_REQUEST;
  const canSubmit = parsed.valid.length > 0 && !tooMany && !busy;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (
      mode === 'replace' &&
      !window.confirm(
        `Thay toàn bộ danh sách (${currentTotal} email) bằng ${parsed.valid.length} email mới?`,
      )
    ) {
      return;
    }
    setResult(null);
    const body: ApprovedEmailsUpdateInput = {
      emails: parsed.valid,
      mode,
      note: note.trim() || undefined,
    };
    const res = await run(() =>
      sendJson<ApprovedEmailsUpdateResult>('/admin/approved-emails', 'PUT', body),
    );
    if (!res.ok) return;
    setResult(res.data);
    setText('');
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="emails" className="font-medium">
          Danh sách email
        </label>
        <p id="emails-help" className="muted text-sm">
          Dán email thành viên, mỗi dòng một email (hoặc cách nhau bằng dấu phẩy). Có thể dán cả cột
          từ Google Sheet.
        </p>
        <textarea
          id="emails"
          aria-describedby="emails-help emails-preview"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-transparent p-3 font-mono text-sm"
          placeholder={'an@student.hcmute.edu.vn\nbinh@gmail.com'}
        />
        <p id="emails-preview" aria-live="polite" className="mt-1 text-sm">
          {parsed.valid.length} email hợp lệ
          {parsed.duplicates > 0 && ` · bỏ ${parsed.duplicates} email trùng`}
          {tooMany && ` · tối đa ${MAX_APPROVED_EMAILS_PER_REQUEST} email mỗi lần`}
        </p>
        {parsed.invalid.length > 0 && (
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Không phải email (sẽ bị bỏ qua): {parsed.invalid.slice(0, 10).join(', ')}
            {parsed.invalid.length > 10 && ` … và ${parsed.invalid.length - 10} mục khác`}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="font-medium">Cách lưu</legend>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={mode === 'append'}
            onChange={() => setMode('append')}
          />
          Thêm vào danh sách hiện có
        </label>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          Thay toàn bộ danh sách (email không có trong danh sách mới sẽ bị xóa; tài khoản đã được
          duyệt vẫn giữ nguyên)
        </label>
      </fieldset>

      <div>
        <label htmlFor="note" className="font-medium">
          Ghi chú <span className="muted font-normal">(tùy chọn, vd: Gen 7)</span>
        </label>
        <input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? 'Đang lưu…' : `Lưu ${parsed.valid.length} email`}
      </button>

      <div aria-live="polite">
        {result && (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            ✓ Đã lưu. Danh sách hiện có {result.total} email
            {result.activated > 0
              ? `, đã duyệt tự động ${result.activated} tài khoản đang chờ.`
              : '.'}
          </p>
        )}
      </div>
      <ProblemAlert problem={problem} />
    </form>
  );
}
