'use client';

import { useState } from 'react';
import type { MentorChoice, MenteeRow } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { isMentorFull, mentorOptionLabel } from './mentor-tracks';

const NONE = '';

/**
 * The mentor of one member in one track, changed by an admin (US-11, learning-hub#120):
 * PUT /admin/mentors/mentees/:id. Mentors of the track are listed first; a mentor at
 * MENTOR_MAX_MENTEES cannot be picked for a new mentee (the API checks it again).
 */
export function MenteeMentorCell({
  row,
  trackSlug,
  mentors,
  maxMentees,
}: {
  row: MenteeRow;
  trackSlug: string;
  mentors: MentorChoice[];
  maxMentees: number;
}) {
  const current = row.mentor?.id ?? NONE;
  const [picked, setPicked] = useState(current);
  const { run, busy, problem } = useMutation();
  const inTrack = mentors.filter((m) => m.inTrack);
  const others = mentors.filter((m) => !m.inTrack);
  const selectId = `mentor-of-${row.member.id}`;

  function option(choice: MentorChoice) {
    const full = isMentorFull(choice, maxMentees, row.mentor?.id ?? null);
    return (
      <option key={choice.mentor.id} value={choice.mentor.id} disabled={full}>
        {mentorOptionLabel(choice, maxMentees)}
        {full ? ' (đã đủ)' : ''}
      </option>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor={selectId}>
          Mentor của @{row.member.githubLogin}
        </label>
        <select
          id={selectId}
          value={picked}
          disabled={busy}
          onChange={(e) => setPicked(e.target.value)}
          className="max-w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        >
          <option value={NONE}>Chưa có mentor</option>
          {inTrack.length > 0 && (
            <optgroup label="Phụ trách track này">{inTrack.map(option)}</optgroup>
          )}
          {others.length > 0 && <optgroup label="Mentor khác">{others.map(option)}</optgroup>}
        </select>
        <button
          type="button"
          disabled={busy || picked === current}
          aria-busy={busy}
          onClick={() =>
            run(() =>
              sendJson(`/admin/mentors/mentees/${encodeURIComponent(row.member.id)}`, 'PUT', {
                trackSlug,
                mentorId: picked || null,
              }),
            )
          }
          className="press rounded-md bg-brand-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Lưu
        </button>
      </div>
      <ProblemAlert problem={problem} />
    </div>
  );
}
