import type { ReactNode } from 'react';
import type { ExerciseView } from '@hub/shared';
import { LinkSubmitForm } from './LinkSubmitForm';

type Code = NonNullable<ExerciseView['code']>;

/**
 * Code exercise in three steps (INFORMATION-ARCHITECTURE §6): create the track repo
 * from the template, work in the exercise folder, paste the PR or commit URL.
 */
export function CodeSteps({ exerciseId, code }: { exerciseId: string; code: Code }) {
  const byPullRequest = code.submitKind === 'github_pr';
  return (
    <ol className="space-y-5">
      <Step number={1} title="Tạo repo của lộ trình từ template">
        {code.starterRepo ? (
          <p>
            <a
              href={`https://github.com/${code.starterRepo}/generate`}
              rel="noopener noreferrer"
              className="inline-block rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:border-brand-500"
            >
              Tạo repo từ <code className="font-mono">{code.starterRepo}</code> ↗
            </a>
          </p>
        ) : (
          <p className="muted">Lộ trình này không có template: dùng repo của riêng bạn.</p>
        )}
        <p className="muted mt-2">
          Chỉ cần làm một lần cho cả lộ trình. Để repo ở chế độ public để mentor xem được.
        </p>
      </Step>

      <Step
        number={2}
        title={byPullRequest ? 'Làm bài và mở pull request' : 'Làm bài và push commit'}
      >
        <p>
          Làm bài trong thư mục <code className="font-mono">{code.starterPath}</code>
          {byPullRequest
            ? ', rồi mở một pull request vào nhánh chính của repo bạn.'
            : ', rồi push commit lên repo của bạn.'}
        </p>
      </Step>

      <Step number={3} title="Nộp đường dẫn">
        <LinkSubmitForm
          exerciseId={exerciseId}
          urlLabel={byPullRequest ? 'URL pull request' : 'URL commit'}
          urlPlaceholder={
            byPullRequest
              ? 'https://github.com/ten-ban/repo/pull/1'
              : 'https://github.com/ten-ban/repo/commit/abc1234'
          }
        />
      </Step>
    </ol>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 font-mono text-sm font-bold text-brand-700"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <h3 className="font-semibold">
          <span className="sr-only">Bước {number}: </span>
          {title}
        </h3>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
