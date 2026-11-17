import type { ContentVersionStatus } from '@hub/shared';
import { VERSION_STATUS_LABEL } from './content-version';

const STATUS_CLASS: Record<ContentVersionStatus, string> = {
  draft: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200',
  superseded: 'bg-zinc-200 text-zinc-800 dark:bg-zinc-500/30 dark:text-zinc-200',
  rejected: 'bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200',
};

export function VersionStatusBadge({ status }: { status: ContentVersionStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_CLASS[status]}`}
    >
      {VERSION_STATUS_LABEL[status]}
    </span>
  );
}
