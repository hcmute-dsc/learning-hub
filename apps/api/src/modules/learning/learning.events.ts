/** Domain events published by the learning module (BACKEND-DESIGN §2 learning, §5). */
export const LearningEvents = {
  /** a member enrolled in a track for the first time */
  Enrolled: 'learning.enrolled',
  /** a member marked a lesson as completed */
  LessonCompleted: 'learning.lesson_completed',
  /** every item of a track is done; stored once, so certificates and stats can use it */
  TrackCompleted: 'learning.track_completed',
} as const;

export interface EnrolledEvent {
  enrollmentId: string;
  userId: string;
  trackId: string;
}

export interface LessonCompletedEvent {
  userId: string;
  lessonId: string;
  trackId: string;
}

export interface TrackCompletedEvent {
  enrollmentId: string;
  userId: string;
  trackId: string;
  completedAt: string;
}
