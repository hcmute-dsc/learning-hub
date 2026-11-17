import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Me, ReviewPage, ReviewedSubmission } from '@hub/shared';
import { TONE_CLASS, submissionTone } from '@/components/exercise/exercise-status';
import { Breadcrumbs } from '@/components/learn/Breadcrumbs';
import { Markdown } from '@/components/markdown/Markdown';
import { ClaimButton } from '@/components/review/ClaimButton';
import { ReleaseButton } from '@/components/review/ReleaseButton';
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewForm } from '@/components/review/ReviewForm';
import { Avatar } from '@/components/ui/Avatar';
import { api, apiOrNotFound } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { SUBMISSION_STATUS_LABEL } from '@/lib/labels';

export const metadata: Metadata = { title: 'Review bài nộp' };

type Params = { params: Promise<{ submissionId: string }> };

/**
 * Review one submission (E7). Left: what was asked and what was submitted, with the
 * member's earlier attempts and their reviews. Right: the review form, once this mentor
 * has claimed it. Two columns on large screens, stacked on phones (form last).
 */
export default async function ReviewSubmissionPage({ params }: Params) {
  const { submissionId } = await params;
  const { data: me } = await api<{ data: Me }>('/auth/me');
  const isAdmin = me.roles.includes('admin');
  if (!isAdmin && !me.roles.includes('mentor')) notFound();
  const { data: page } = await apiOrNotFound<{ data: ReviewPage }>(
    `/reviews/submissions/${encodeURIComponent(submissionId)}`,
  );
  const { submission, member, exercise } = page;

  return (
    <div className="page-wide space-y-6">
      <header className="motion-fade-up space-y-4">
        <Breadcrumbs
          items={[{ label: 'Hàng đợi review', href: '/review' }, { label: exercise.title }]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Avatar src={member.avatarUrl} size={44} />
          <div className="min-w-0">
            <h1 className="text-2xl leading-tight font-bold">{exercise.title}</h1>
            <p className="muted text-sm">
              {member.displayName} (@{member.githubLogin}) · {page.track.title} · lần{' '}
              {submission.attempt}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="submission-title" className="surface rounded-2xl p-5">
            <h2 id="submission-title" className="font-semibold">
              Bài nộp
            </h2>
            <SubmissionDetails submission={submission} />
          </section>

          <details className="surface rounded-2xl p-5">
            <summary className="cursor-pointer font-semibold">Đề bài</summary>
            <div className="mt-4">
              <Markdown source={exercise.statementMd} />
            </div>
          </details>

          {page.earlierAttempts.length > 0 && (
            <section aria-labelledby="earlier-title" className="surface rounded-2xl p-5">
              <h2 id="earlier-title" className="font-semibold">
                Các lần nộp trước ({page.earlierAttempts.length})
              </h2>
              <ol className="mt-3 space-y-4">
                {page.earlierAttempts.map((attempt) => (
                  <li key={attempt.id} className="border-t border-[var(--border)] pt-3">
                    <p className="text-sm font-medium">Lần {attempt.attempt}</p>
                    <SubmissionDetails submission={attempt} />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <section
          aria-labelledby="review-title"
          className="surface rounded-2xl p-5 lg:sticky lg:top-20"
        >
          <div aria-hidden className="-mx-5 -mt-5 mb-5 h-1 rounded-t-2xl bg-brand-500" />
          <h2 id="review-title" className="mb-4 text-lg font-semibold">
            Review
          </h2>
          <ReviewPanel page={page} meId={me.id} isAdmin={isAdmin} />
        </section>
      </div>
    </div>
  );
}

/** Right column: what this mentor can do with the submission right now. */
function ReviewPanel({
  page,
  meId,
  isAdmin,
}: {
  page: ReviewPage;
  meId: string;
  isAdmin: boolean;
}) {
  const { submission, openReview } = page;

  if (submission.status !== 'awaiting_review') {
    return (
      <div className="space-y-3 text-sm">
        <p>
          Bài nộp này không còn chờ review
          {submission.review ? ' (kết quả review nằm ở phần “Bài nộp”)' : ''}.
        </p>
        <BackToQueue />
      </div>
    );
  }
  if (!page.canReview) {
    return (
      <div className="space-y-3 text-sm">
        <p>Đây là bài nộp của bạn. Hãy nhờ một mentor khác review.</p>
        <BackToQueue />
      </div>
    );
  }
  if (!openReview) {
    return (
      <div className="space-y-3 text-sm">
        <p className="muted">
          Nhận review trước khi chấm, để mentor khác biết bài này đã có người xem.
        </p>
        <ClaimButton submissionId={submission.id} openAfter={false} />
      </div>
    );
  }
  if (openReview.reviewer.id !== meId) {
    return (
      <div className="space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <Avatar src={openReview.reviewer.avatarUrl} size={24} />
          <span>
            <span className="font-medium">{openReview.reviewer.displayName}</span> đã nhận review
            lúc {formatDateTime(openReview.claimedAt)}.
          </span>
        </p>
        {isAdmin && <ReleaseButton reviewId={openReview.id} label="Bỏ nhận giúp mentor" />}
        <BackToQueue />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="muted text-sm">
        Bạn đã nhận review lúc {formatDateTime(openReview.claimedAt)}. Nhận xét chỉ được lưu khi bấm
        “Hoàn thành review”.
      </p>
      <ReviewForm reviewId={openReview.id} rubric={page.exercise.rubric} />
      <ReleaseButton reviewId={openReview.id} />
    </div>
  );
}

function SubmissionDetails({ submission }: { submission: ReviewedSubmission }) {
  const tone = submissionTone(submission.status);
  return (
    <div className="mt-2 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${TONE_CLASS[tone]}`}>
          {SUBMISSION_STATUS_LABEL[submission.status]}
        </span>
        <time dateTime={submission.submittedAt} className="muted text-xs">
          {formatDateTime(submission.submittedAt)}
        </time>
      </div>
      {submission.sourceUrl && (
        <p className="break-all">
          <a
            href={submission.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="font-mono font-medium underline underline-offset-2 hover:text-brand-700"
          >
            {submission.sourceUrl}
          </a>
        </p>
      )}
      {submission.note && (
        <blockquote className="border-l-2 border-[var(--border)] pl-3 whitespace-pre-line">
          {submission.note}
        </blockquote>
      )}
      {submission.review && <ReviewCard review={submission.review} />}
    </div>
  );
}

function BackToQueue() {
  return (
    <Link
      href="/review"
      prefetch={false}
      className="inline-block font-medium underline underline-offset-2 hover:text-brand-700"
    >
      ← Về hàng đợi review
    </Link>
  );
}
