import type { ReviewThread as Thread } from '@hub/shared';
import { Markdown } from '@/components/markdown/Markdown';
import { Avatar } from '@/components/ui/Avatar';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { THREAD_ROLE_LABEL, threadTitle } from './review-thread';
import { ReplyForm, ThanksForm, ThanksVisibility } from './ThreadForms';

/**
 * The conversation under a finished review (learning-hub#41): the member asks back, the
 * mentor answers, and the member can thank the mentor once. Loaded per review on the
 * server; the API answers 403 to anyone outside the conversation (another mentor on the
 * review page), and then nothing is shown.
 */
export async function ReviewThread({ reviewId }: { reviewId: string }) {
  let thread: Thread;
  try {
    thread = (await api<{ data: Thread }>(`/reviews/${encodeURIComponent(reviewId)}/thread`)).data;
  } catch (e) {
    if (e instanceof ApiError && (e.problem.status === 403 || e.problem.status === 404)) {
      return null;
    }
    throw e;
  }
  const { messages } = thread;

  return (
    <details
      open={messages.length > 0 || thread.thanks !== null}
      className="mt-2 rounded-lg border border-[var(--border)] p-3"
    >
      <summary className="cursor-pointer text-sm font-medium">
        <span aria-hidden>💬 </span>
        {threadTitle(thread.viewerRole, messages.length)}
      </summary>

      {messages.length === 0 && thread.viewerRole === 'mentee' && (
        <p className="muted mt-2 text-xs">
          Chưa hiểu nhận xét nào? Hỏi lại mentor ở đây, mentor sẽ được báo.
        </p>
      )}

      {messages.length > 0 && (
        <ol className="mt-3 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className="text-sm">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Avatar src={m.author.avatarUrl} size={18} />
                <span className="font-medium">{m.author.displayName}</span>
                <span className="muted rounded-full border border-[var(--border)] px-1.5">
                  {THREAD_ROLE_LABEL[m.role]}
                </span>
                <time dateTime={m.createdAt} className="muted">
                  {formatDateTime(m.createdAt)}
                </time>
              </div>
              <div className="mt-1 pl-6">
                {/* Written by members, sanitized like all Markdown (SECURITY §3). */}
                <Markdown source={m.bodyMd} />
              </div>
            </li>
          ))}
        </ol>
      )}

      {thread.canPost && <ReplyForm reviewId={reviewId} />}

      {thread.thanks && (
        <figure className="mt-3 rounded-lg bg-[var(--code-bg)] p-3 text-sm">
          <figcaption className="muted text-xs">
            <span aria-hidden>💛 </span>
            {thread.viewerRole === 'mentee' ? 'Lời cảm ơn bạn đã gửi' : 'Lời cảm ơn của thành viên'}
          </figcaption>
          <blockquote className="mt-1 whitespace-pre-line">{thread.thanks.body}</blockquote>
          {thread.canShowThanks && (
            <ThanksVisibility reviewId={reviewId} isPublic={thread.thanks.isPublic} />
          )}
        </figure>
      )}
      {thread.canThank && <ThanksForm reviewId={reviewId} />}
    </details>
  );
}
