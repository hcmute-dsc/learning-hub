'use client';

import { useState } from 'react';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';

/**
 * Approve a pending account: POST /admin/users/:id/approve (mentors and admins,
 * USER-FLOWS §1). Shared by the "Đang chờ duyệt" box and the accounts table.
 * Approved ids are kept locally so the row changes at once; the page data is
 * refreshed too (useMutation), which updates the other section.
 */
export function useApproveAccount() {
  const { run, busy, problem } = useMutation();
  // Which row was clicked, so only that button says "Đang duyệt…".
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);

  async function approve(id: string) {
    setClickedId(id);
    const result = await run(() =>
      sendJson(`/admin/users/${encodeURIComponent(id)}/approve`, 'POST'),
    );
    if (result.ok) setApprovedIds((ids) => [...ids, id]);
  }

  return {
    approve,
    busy,
    problem,
    isApproving: (id: string) => busy && clickedId === id,
    isApproved: (id: string) => approvedIds.includes(id),
  };
}
