import type { NotificationItem } from '@hub/shared';

/** Header badge text: nothing for 0, "9+" above nine so the badge stays round. */
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}

/** Screen-reader name of the bell button. */
export function bellLabel(count: number): string {
  return count > 0 ? `Thông báo, ${count} chưa đọc` : 'Thông báo';
}

/** After a click: the list and count as if the API already answered (optimistic). */
export function markOneRead(
  items: NotificationItem[],
  id: string,
  unread: number,
): { items: NotificationItem[]; unread: number } {
  let changed = false;
  const next = items.map((item) => {
    if (item.id !== id || item.read) return item;
    changed = true;
    return { ...item, read: true };
  });
  return { items: next, unread: changed ? Math.max(0, unread - 1) : unread };
}

export function markEveryRead(items: NotificationItem[]): NotificationItem[] {
  return items.map((item) => (item.read ? item : { ...item, read: true }));
}

/** Icon per type, decorative only (the title says what happened). */
export const TYPE_ICON: Record<NotificationItem['type'], string> = {
  review_completed: '✅',
  review_requested: '📝',
  track_published: '🆕',
  review_message: '💬',
  review_thanks: '💛',
  content_report: '🛠️',
  mentor_assignment: '🤝',
};
