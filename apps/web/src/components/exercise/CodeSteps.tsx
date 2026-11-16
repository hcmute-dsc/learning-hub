import type { ExerciseView } from '@hub/shared';
import { LinkSubmitForm } from './LinkSubmitForm';
import { Step, Stepper } from './Stepper';

type Code = NonNullable<ExerciseView['code']>;

/**
 * Code exercise in three steps (INFORMATION-ARCHITECTURE §6): create the track repo
 * from the template, work in the exercise folder, paste the PR or commit URL.
 */
export function CodeSteps({ exerciseId, code }: { exerciseId: string; code: Code }) {
  const byPullRequest = code.submitKind === 'github_pr';
  return (
    <Stepper>
      <Step number={1} title="Tạo repo từ template">
        {code.starterRepo ? (
          <a
            href={`https://github.com/${code.starterRepo}/generate`}
            rel="noopener noreferrer"
            className="press inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] px-3 py-2 font-medium hover:border-brand-500"
          >
            <span className="min-w-0 truncate">
              Tạo repo từ <code className="font-mono">{code.starterRepo}</code>
            </span>
            <span aria-hidden>↗</span>
            <span className="sr-only">(mở GitHub)</span>
          </a>
        ) : (
          <p className="muted">Lộ trình này không có template: dùng repo của riêng bạn.</p>
        )}
        <p className="muted mt-2">
          Chỉ cần làm một lần cho cả lộ trình. Để repo ở chế độ public để mentor xem được.
        </p>
      </Step>

      <Step number={2} title="Làm bài trong thư mục của bài tập">
        <p className="rounded-lg bg-[var(--code-bg)] px-3 py-2 font-mono text-sm break-all">
          {code.starterPath}
        </p>
        <p className="mt-2">
          {byPullRequest
            ? 'Xong thì mở một pull request vào nhánh chính của repo bạn.'
            : 'Xong thì commit và push lên repo của bạn.'}
        </p>
      </Step>

      <Step number={3} title="Nộp link" last>
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
    </Stepper>
  );
}
