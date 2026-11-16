import type {
  Difficulty,
  ExerciseState,
  ExerciseType,
  ErrorCode,
  LessonStatus,
  SubmissionStatus,
  TrackLevel,
} from '@hub/shared';

/**
 * Every Vietnamese label for an enum from @hub/shared lives here, so a wording change
 * is made once (FRONTEND-DESIGN §11). `Record<...>` makes TypeScript fail when the
 * shared package adds a value that has no label yet.
 */

export const LEVEL_LABEL: Record<TrackLevel, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  code: 'Code',
  quiz: 'Quiz',
  project: 'Dự án',
  self_check: 'Tự kiểm tra',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Dễ',
  medium: 'Vừa',
  hard: 'Khó',
};

/** Label + icon: state must never be shown by color alone (FRONTEND-DESIGN §9). */
export const EXERCISE_STATE_LABEL: Record<ExerciseState, { text: string; icon: string }> = {
  locked: { text: 'Đang khóa', icon: '🔒' },
  not_started: { text: 'Chưa làm', icon: '○' },
  attempted: { text: 'Đã thử, chưa đạt', icon: '↻' },
  testing: { text: 'Đang chấm', icon: '⏳' },
  in_review: { text: 'Chờ mentor review', icon: '👀' },
  needs_changes: { text: 'Cần sửa', icon: '✎' },
  completed: { text: 'Hoàn thành', icon: '✓' },
};

export const LESSON_PROGRESS_LABEL: Record<LessonStatus, { text: string; icon: string }> = {
  not_started: { text: 'Chưa học', icon: '○' },
  in_progress: { text: 'Đang học', icon: '◐' },
  completed: { text: 'Đã học', icon: '✓' },
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: 'Đã nộp',
  testing: 'Đang chạy test',
  passed: 'Đạt',
  failed: 'Chưa đạt',
  awaiting_review: 'Chờ review',
  approved: 'Đã duyệt',
  changes_requested: 'Cần sửa',
  errored: 'Lỗi khi chấm',
};

/** problem+json `code` → Vietnamese message (FRONTEND-DESIGN §7). */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  BAD_REQUEST: 'Yêu cầu không hợp lệ.',
  VALIDATION_FAILED: 'Dữ liệu chưa hợp lệ, hãy kiểm tra lại.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  ACCOUNT_PENDING: 'Tài khoản của bạn đang chờ Ban chủ nhiệm duyệt.',
  NOT_FOUND: 'Không tìm thấy nội dung này.',
  CONFLICT: 'Thao tác bị trùng hoặc xung đột với dữ liệu hiện có.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.',
  UPSTREAM_ERROR: 'Không kết nối được dịch vụ bên ngoài (GitHub). Thử lại sau.',
  INTERNAL_ERROR: 'Có lỗi phía máy chủ. Thử lại sau ít phút.',
};
