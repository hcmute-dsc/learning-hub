import type { TrackProgress } from '@hub/shared';

/**
 * Pure rules for the dashboard (USER-FLOWS §2), kept out of the components so they can
 * be unit tested (dashboard.test.ts).
 */

/** Lessons + exercises of one enrolled track, done and total. */
export function countItems(track: TrackProgress): { done: number; total: number } {
  return {
    done: track.lessons.done + track.exercises.done,
    total: track.lessons.total + track.exercises.total,
  };
}

/**
 * The track behind the "Tiếp tục học" card. The API has no "last activity" date yet, so:
 * an active track that still has a next item, preferring one the member already started
 * (percent > 0), then the most recently enrolled. null when there is nothing to continue.
 */
export function pickContinueTrack(enrollments: TrackProgress[]): TrackProgress | null {
  let best: TrackProgress | null = null;
  for (const track of enrollments) {
    if (track.status !== 'active' || !track.next) continue;
    if (!best || isBetterToContinue(track, best)) best = track;
  }
  return best;
}

function isBetterToContinue(a: TrackProgress, b: TrackProgress): boolean {
  const aStarted = a.percent > 0;
  const bStarted = b.percent > 0;
  if (aStarted !== bStarted) return aStarted;
  return a.enrolledAt > b.enrolledAt; // ISO dates compare correctly as strings
}

/**
 * Tracks whose "Cài đặt" page the member should open first (learning-hub#44): active, the
 * track has docs/setup.md, and nothing is done yet, which is the case right after enrolling.
 * Once the member finishes a first item the reminder goes away. Newest enrollment first.
 */
export function setupReminders(enrollments: TrackProgress[]): TrackProgress[] {
  return enrollments
    .filter((t) => t.status === 'active' && t.hasSetup && countItems(t).done === 0)
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));
}

/** One friendly line under the welcome title, based on how far the member is. */
export function encouragement(enrollments: TrackProgress[]): string {
  if (enrollments.length === 0) {
    return 'Chọn lộ trình đầu tiên và bắt đầu học bằng cách làm nhé.';
  }
  if (enrollments.every((t) => t.status === 'completed')) {
    return 'Bạn đã hoàn thành mọi lộ trình đã tham gia. Thử thêm một lộ trình mới chứ?';
  }
  let done = 0;
  for (const track of enrollments) done += countItems(track).done;
  if (done === 0) return 'Mỗi ngày một bài nhỏ là đủ để đi xa. Bắt đầu thôi!';
  return `Bạn đã hoàn thành ${done} mục trên ${enrollments.length} lộ trình. Giữ vững phong độ nhé!`;
}
