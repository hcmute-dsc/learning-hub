'use client';

import { useState } from 'react';
import {
  CONTENT_REPORT_NOTE_MAX,
  CONTENT_REPORT_STATUS_LABEL,
  type ContentReportRow,
  type ContentReportStatus,
} from '@hub/shared';
import { nextStatuses } from '@/components/content-report/content-report-format';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

const FIELD = 'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-sm';
const BUTTON =
  'press rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:border-brand-500 disabled:opacity-60';

/**
 * Staff actions on one content report (learning-hub#121): change the status (the reporter
 * hears back when it becomes "Đã sửa" or "Không sửa"), keep a note for staff, and open an
 * issue in the track repo. Each one reloads the page data through useMutation.
 */
export function ContentReportActions({
  report,
  canCreateIssue,
}: {
  report: ContentReportRow;
  canCreateIssue: boolean;
}) {
  const { run, busy, problem } = useMutation();
  const [status, setStatus] = useState<ContentReportStatus | ''>('');
  const [note, setNote] = useState(report.staffNote ?? '');

  const save = () =>
    run(() =>
      sendJson<ContentReportRow>(`/content-reports/${report.id}`, 'PATCH', {
        ...(status ? { status } : {}),
        ...(note !== (report.staffNote ?? '') ? { staffNote: note } : {}),
      }),
    ).then((r) => {
      if (r.ok) setStatus('');
    });

  const createIssue = () =>
    run(() => sendJson<{ url: string }>(`/content-reports/${report.id}/github-issue`, 'POST'));

  const changed = status !== '' || note !== (report.staffNote ?? '');

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="muted text-xs">Đổi trạng thái</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContentReportStatus | '')}
            className={FIELD}
          >
            <option value="">Giữ: {CONTENT_REPORT_STATUS_LABEL[report.status]}</option>
            {nextStatuses(report.status).map((s) => (
              <option key={s} value={s}>
                {CONTENT_REPORT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="muted text-xs">Ghi chú (chỉ admin, mentor thấy)</span>
          <input
            value={note}
            maxLength={CONTENT_REPORT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            className={FIELD}
          />
        </label>
        <button type="button" onClick={save} disabled={busy || !changed} className={BUTTON}>
          Lưu
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {report.githubIssueUrl ? (
          <a
            href={report.githubIssueUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="text-brand-600 hover:underline"
          >
            Issue trên GitHub ↗
          </a>
        ) : canCreateIssue ? (
          <button type="button" onClick={createIssue} disabled={busy} className={BUTTON}>
            Tạo issue trên GitHub
          </button>
        ) : (
          <span className="muted text-xs">Chưa cấu hình tạo issue GitHub.</span>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {problem.title}
        </p>
      )}
    </div>
  );
}
