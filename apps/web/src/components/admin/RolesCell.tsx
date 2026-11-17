'use client';

import { useState } from 'react';
import type { AdminUserRow, Role } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { ROLE_LABEL, visibleRoles } from '@/components/profile/profile';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { ConfirmDialog } from './ConfirmDialog';
import { EDITABLE_ROLES, grantsAdmin, roleLockReason, sameRoles, toggleRole } from './role-edit';

/**
 * Roles of one account, editable in place by an admin: PUT /admin/users/:id/roles.
 * Granting admin asks first, because an admin sees every email (SECURITY §1).
 */
export function RolesCell({ row, isSelf }: { row: AdminUserRow; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Role[]>(row.roles);
  const [confirming, setConfirming] = useState(false);
  const { run, busy, problem, setProblem } = useMutation();

  function startEditing() {
    setDraft(row.roles);
    setProblem(null);
    setEditing(true);
  }

  async function save() {
    const result = await run(() =>
      sendJson(`/admin/users/${encodeURIComponent(row.id)}/roles`, 'PUT', { roles: draft }),
    );
    setConfirming(false);
    if (result.ok) setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>
          {visibleRoles(row.roles)
            .map((role) => ROLE_LABEL[role])
            .join(', ')}
        </span>
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Sửa vai trò của @${row.githubLogin}`}
          className="press rounded-md border border-[var(--border)] px-2 py-0.5 hover:border-brand-500"
        >
          Sửa
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-44">
      <fieldset disabled={busy}>
        <legend className="sr-only">Vai trò của @{row.githubLogin}</legend>
        <label className="muted flex items-center gap-1.5 py-0.5">
          <input type="checkbox" checked readOnly disabled />
          {ROLE_LABEL.member}
        </label>
        {EDITABLE_ROLES.map((role) => {
          const lock = roleLockReason(role, row.roles, isSelf);
          return (
            <label
              key={role}
              className="flex items-center gap-1.5 py-0.5"
              title={lock ?? undefined}
            >
              <input
                type="checkbox"
                checked={draft.includes(role)}
                disabled={!!lock}
                onChange={() => setDraft((roles) => toggleRole(roles, role))}
              />
              {ROLE_LABEL[role]}
            </label>
          );
        })}
      </fieldset>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={() => (grantsAdmin(row.roles, draft) ? setConfirming(true) : save())}
          disabled={busy || sameRoles(draft, row.roles)}
          aria-busy={busy}
          className="press rounded-md bg-brand-600 px-2 py-0.5 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="press rounded-md border border-[var(--border)] px-2 py-0.5 hover:border-brand-500"
        >
          Hủy
        </button>
      </div>
      <ProblemAlert problem={problem} />

      <ConfirmDialog
        open={confirming}
        title={`Cấp quyền admin cho @${row.githubLogin}?`}
        confirmLabel="Cấp quyền admin"
        danger
        busy={busy}
        onConfirm={save}
        onCancel={() => setConfirming(false)}
      >
        <p>
          Admin (Ban chủ nhiệm) xem được email của mọi thành viên, đổi vai trò, tạm khóa tài khoản
          và publish nội dung.
        </p>
        <p>Chỉ cấp cho người trong Ban chủ nhiệm. Việc này được ghi vào nhật ký.</p>
      </ConfirmDialog>
    </div>
  );
}
