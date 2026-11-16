import Link from 'next/link';
import type { ItemRef } from '@hub/shared';
import { exerciseHref } from '@/components/learn/links';

/** Shown instead of the submit panel while prerequisite exercises are not completed. */
export function LockedNotice({ lockedBy }: { lockedBy: ItemRef[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 text-sm">
      <p className="font-semibold">
        <span aria-hidden>🔒 </span>Bài tập này đang khóa
      </p>
      <p className="mt-1">Hoàn thành các bài tập sau để mở khóa:</p>
      <ul className="mt-2 list-disc pl-5">
        {lockedBy.map((item) => (
          <li key={item.id}>
            <Link href={exerciseHref(item.id)} className="underline">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
