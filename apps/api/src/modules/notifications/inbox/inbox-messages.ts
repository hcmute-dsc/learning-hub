import type { NotificationType } from '@hub/shared';

/**
 * Text of one bell notification (learning-hub#49). Built once, when the row is written,
 * and stored in `notifications.payload`, so reading the bell needs no joins. Plain text:
 * React escapes it in the bell and the digest escapes it for HTML.
 */
export interface InboxPayload {
  title: string;
  body: string | null;
  /** a path inside the web app */
  link: string;
}

export interface InboxNotice {
  type: NotificationType;
  payload: InboxPayload;
}

const MAX_TITLE = 120;

/** Content titles come from content repos; keep one line of reasonable length. */
export function oneLine(value: string, max = MAX_TITLE): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** To the member whose submission a mentor just reviewed. */
export function reviewCompletedNotice(info: {
  exerciseId: string;
  exerciseTitle: string;
  trackTitle: string;
  outcome: 'approved' | 'changes_requested';
}): InboxNotice {
  const exercise = oneLine(info.exerciseTitle);
  const title =
    info.outcome === 'approved' ? `Bài "${exercise}" đã đạt` : `Bài "${exercise}" cần sửa thêm`;
  const body =
    info.outcome === 'approved'
      ? `Mentor đã duyệt bài của bạn trong ${oneLine(info.trackTitle)}.`
      : `Mentor đã góp ý bài của bạn trong ${oneLine(info.trackTitle)}. Xem nhận xét rồi nộp lại nhé.`;
  return {
    type: 'review_completed',
    payload: { title, body, link: `/exercises/${info.exerciseId}` },
  };
}

/**
 * Where each side reads the conversation on a review (learning-hub#41): the member on
 * their exercise page, at the review card; the mentor on the review page.
 */
export function threadLink(
  forMember: boolean,
  info: { exerciseId: string; submissionId: string },
): string {
  return forMember
    ? `/exercises/${info.exerciseId}#review-${info.submissionId}`
    : `/review/${info.submissionId}`;
}

/**
 * A new message on a review, to the other side. No text from the message itself: the
 * bell and the digest email are not the place for a private conversation.
 */
export function reviewMessageNotice(info: {
  forMember: boolean;
  exerciseId: string;
  submissionId: string;
  exerciseTitle: string;
}): InboxNotice {
  const exercise = oneLine(info.exerciseTitle);
  return {
    type: 'review_message',
    payload: {
      title: info.forMember
        ? `Mentor trả lời về bài "${exercise}"`
        : `Thành viên hỏi lại về bài "${exercise}"`,
      body: 'Mở trao đổi dưới phần nhận xét để đọc và trả lời.',
      link: threadLink(info.forMember, info),
    },
  };
}

/** The member thanked the mentor; the note itself is read on the review page. */
export function reviewThanksNotice(info: {
  exerciseId: string;
  submissionId: string;
  exerciseTitle: string;
}): InboxNotice {
  return {
    type: 'review_thanks',
    payload: {
      title: `Bạn nhận được lời cảm ơn cho review bài "${oneLine(info.exerciseTitle)}"`,
      body: 'Bạn có thể chọn hiện lời cảm ơn này trên hồ sơ của mình.',
      link: threadLink(false, info),
    },
  };
}

/** To every mentor and admin: a project is waiting in the review queue. No member name (SECURITY §1). */
export function reviewRequestedNotice(info: {
  submissionId: string;
  exerciseTitle: string;
  trackTitle: string;
}): InboxNotice {
  return {
    type: 'review_requested',
    payload: {
      title: `Bài chờ review: ${oneLine(info.exerciseTitle)}`,
      body: oneLine(info.trackTitle),
      link: `/review/${info.submissionId}`,
    },
  };
}

/** To every active member: a whole new track went live. */
export function trackPublishedNotice(info: { slug: string; title: string }): InboxNotice {
  return {
    type: 'track_published',
    payload: {
      title: `Lộ trình mới: ${oneLine(info.title)}`,
      body: 'Vừa được mở trên Learning Hub. Vào xem và đăng ký nhé.',
      link: `/tracks/${encodeURIComponent(info.slug)}`,
    },
  };
}

/**
 * To the member whose content report was closed (learning-hub#121). Links to the page they
 * reported, so they see the fix; no staff note, which is for staff only.
 */
export function contentReportClosedNotice(info: {
  status: 'resolved' | 'dismissed';
  targetTitle: string;
  targetLink: string;
}): InboxNotice {
  const target = oneLine(info.targetTitle);
  return {
    type: 'content_report',
    payload:
      info.status === 'resolved'
        ? {
            title: `Lỗi bạn báo ở "${target}" đã được sửa`,
            body: 'Cảm ơn bạn đã báo. Bản sửa có trên trang sau lần cập nhật nội dung tới.',
            link: info.targetLink,
          }
        : {
            title: `Mentor đã xem lỗi bạn báo ở "${target}"`,
            body: 'Lần này nội dung được giữ nguyên. Nếu vẫn thấy sai, hỏi mentor trên Discord nhé.',
            link: info.targetLink,
          },
  };
}

/** Read a stored payload back; tolerant of rows written by an older version. */
export function readPayload(value: unknown): InboxPayload {
  const v = (value ?? {}) as Partial<Record<keyof InboxPayload, unknown>>;
  return {
    title: typeof v.title === 'string' ? v.title : 'Thông báo',
    body: typeof v.body === 'string' ? v.body : null,
    // "//host" is protocol-relative: it would leave the site, so only single-slash paths pass.
    link:
      typeof v.link === 'string' && v.link.startsWith('/') && !v.link.startsWith('//')
        ? v.link
        : '/dashboard',
  };
}
