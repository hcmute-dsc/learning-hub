'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { NotificationItem, NotificationList } from '@hub/shared';
import { getJson, sendJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { TYPE_ICON, badgeLabel, bellLabel, markEveryRead, markOneRead } from './bell';

/** How often the badge asks for the unread count while the tab is open. */
const POLL_MS = 60_000;

/**
 * Header bell (learning-hub#49): unread badge, a dropdown with the latest notifications,
 * mark one or all as read. Client-side so the badge updates without reloading the page;
 * the API only ever returns the signed-in member's own notifications.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const refreshCount = useCallback(async () => {
    const res = await getJson<{ data: { count: number } }>('/me/notifications/unread-count');
    if (res.ok) setUnread(res.data.data.count);
  }, []);

  const loadList = useCallback(async () => {
    const res = await getJson<NotificationList>('/me/notifications');
    if (res.ok) {
      setItems(res.data.data);
      setUnread(res.data.unreadCount);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, []);

  // Count on load, on every page change, when the tab comes back, and once a minute.
  useEffect(() => {
    void refreshCount();
  }, [refreshCount, pathname]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCount();
    }, POLL_MS);
    const onFocus = () => void refreshCount();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshCount]);

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) void loadList();
  }

  function readOne(id: string) {
    if (!items) return;
    const next = markOneRead(items, id, unread);
    setItems(next.items);
    setUnread(next.unread);
    setOpen(false);
    void sendJson(`/me/notifications/${id}/read`, 'POST');
  }

  async function readAll() {
    if (!items) return;
    setItems(markEveryRead(items));
    setUnread(0);
    const res = await sendJson('/me/notifications/read-all', 'POST');
    if (!res.ok) void loadList();
  }

  const badge = badgeLabel(unread);
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={bellLabel(unread)}
        aria-expanded={open}
        aria-controls={panelId}
        title="Thông báo"
        className="relative inline-grid min-h-11 min-w-11 place-items-center rounded-md p-1.5 text-lg leading-none hover:bg-[var(--bg)] md:inline-block md:min-h-0 md:min-w-0"
      >
        <span aria-hidden>🔔</span>
        {badge && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] rounded-full bg-brand-600 px-1 text-center text-[10px] leading-[1.1rem] font-semibold text-white"
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className="surface absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl p-2 shadow-lg"
        >
          <div className="flex items-center justify-between px-2 py-1">
            <h2 className="text-sm font-semibold">Thông báo</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>
          {items === null && !failed && <p className="muted px-2 py-3 text-sm">Đang tải…</p>}
          {failed && (
            <p className="px-2 py-3 text-sm text-red-700 dark:text-red-300">
              Không tải được thông báo. Thử lại sau nhé.
            </p>
          )}
          {items?.length === 0 && <p className="muted px-2 py-3 text-sm">Chưa có thông báo nào.</p>}
          {items && items.length > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link}
                    onClick={() => readOne(item.id)}
                    className={`flex gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--bg)] ${
                      item.read ? 'muted' : ''
                    }`}
                  >
                    <span aria-hidden>{TYPE_ICON[item.type] ?? '🔔'}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block ${item.read ? '' : 'font-semibold'}`}>
                        {item.title}
                        {!item.read && <span className="sr-only"> (chưa đọc)</span>}
                      </span>
                      {item.body && <span className="muted block text-xs">{item.body}</span>}
                      <span className="muted block text-xs">{formatDateTime(item.createdAt)}</span>
                    </span>
                    {!item.read && (
                      <span aria-hidden className="mt-1.5 h-2 w-2 rounded-full bg-brand-600" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-[var(--border)] px-2 pt-2 text-xs">
            <Link
              href="/settings#notify-heading"
              onClick={() => setOpen(false)}
              className="muted hover:underline"
            >
              Cài đặt email tóm tắt
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
