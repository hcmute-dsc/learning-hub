/**
 * Shown instead of the submit panel while prerequisite exercises are not completed.
 * The links to those exercises are in the status banner under the title
 * (ExerciseStatusBanner.tsx), so they are not repeated here.
 */
export function LockedNotice() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm">
      <p aria-hidden className="text-3xl">
        🔒
      </p>
      <p className="mt-2 font-semibold">Phần làm bài đang khóa</p>
      <p className="muted mt-1">
        Hoàn thành các bài tập tiên quyết trong thông báo phía trên để mở khóa.
      </p>
    </div>
  );
}
