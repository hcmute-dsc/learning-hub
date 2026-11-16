import type { ExerciseState, SubmissionStatus } from '@hub/shared';

/**
 * Which colored message an exercise or a submission gets, kept out of the components
 * so the rules have a unit test (exercise-status.test.ts). Color is only extra: every
 * tone is shown together with words (FRONTEND-DESIGN §9).
 */

export type Tone = 'neutral' | 'info' | 'review' | 'warning' | 'success' | 'danger';

/** Border, background and text color of a box in each tone, light and dark (AA contrast). */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-[var(--border)] bg-[var(--code-bg)]',
  info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100',
  review:
    'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100',
  warning:
    'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-100',
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  danger:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100',
};

export interface StatusBanner {
  tone: Tone;
  title: string;
  body: string;
}

/**
 * The banner under the exercise title. States the member can act on, or should wait
 * for, get one; `not_started` and `attempted` do not, because the action panel already
 * says what to do next.
 */
export function statusBanner(state: ExerciseState): StatusBanner | null {
  switch (state) {
    case 'locked':
      return {
        tone: 'neutral',
        title: 'Bài tập đang khóa',
        body: 'Hoàn thành các bài tập sau để mở khóa:',
      };
    case 'testing':
      return {
        tone: 'info',
        title: 'Đang chấm bài',
        body: 'Bài nộp gần nhất đang được chạy test. Tải lại trang sau ít phút để xem kết quả.',
      };
    case 'in_review':
      return {
        tone: 'review',
        title: 'Đang chờ mentor review',
        body: 'Bạn đã nộp bài. Mentor sẽ xem bài nộp gần nhất và phản hồi cho bạn.',
      };
    case 'needs_changes':
      return {
        tone: 'warning',
        title: 'Mentor yêu cầu sửa',
        body: 'Đọc nhận xét của mentor, sửa bài rồi nộp lại đường dẫn ở phần “Làm bài”.',
      };
    case 'completed':
      return {
        tone: 'success',
        title: 'Hoàn thành rồi!',
        body: 'Làm tốt lắm. Bạn vẫn có thể xem lại đề bài và lịch sử nộp bài bất cứ lúc nào.',
      };
    default:
      return null;
  }
}

/** Tone of one past submission in the attempt history. */
export function submissionTone(status: SubmissionStatus): Tone {
  switch (status) {
    case 'passed':
    case 'approved':
      return 'success';
    case 'failed':
    case 'errored':
      return 'danger';
    case 'changes_requested':
      return 'warning';
    case 'awaiting_review':
      return 'review';
    default:
      return 'info';
  }
}
