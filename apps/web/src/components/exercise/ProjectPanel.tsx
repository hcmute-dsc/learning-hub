import type { ExerciseView } from '@hub/shared';
import { LinkSubmitForm } from './LinkSubmitForm';
import { rubricShares } from './rubric';
import { Step, Stepper } from './Stepper';

type Project = NonNullable<ExerciseView['project']>;

/** Project exercise: the rubric the mentor will use, then the link form (INFORMATION-ARCHITECTURE §6). */
export function ProjectPanel({ exerciseId, project }: { exerciseId: string; project: Project }) {
  const githubOnly = project.deliverable === 'github_repo_or_pr';
  const hasRubric = project.rubric.length > 0;
  return (
    <Stepper>
      {hasRubric && (
        <Step number={1} title="Xem tiêu chí chấm">
          <RubricTable rubric={project.rubric} />
        </Step>
      )}
      <Step number={hasRubric ? 2 : 1} title="Nộp link sản phẩm" last>
        <LinkSubmitForm
          exerciseId={exerciseId}
          urlLabel={githubOnly ? 'URL repo hoặc pull request trên GitHub' : 'Đường dẫn sản phẩm'}
          urlPlaceholder={githubOnly ? 'https://github.com/ten-ban/du-an' : 'https://…'}
        />
      </Step>
    </Stepper>
  );
}

function RubricTable({ rubric }: { rubric: Project['rubric'] }) {
  const shares = rubricShares(rubric);
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Tiêu chí chấm và trọng số</caption>
        <thead className="bg-[var(--code-bg)]">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Tiêu chí
            </th>
            <th scope="col" className="w-28 px-3 py-2 text-right font-medium">
              Trọng số
            </th>
          </tr>
        </thead>
        <tbody>
          {rubric.map((row, index) => (
            <tr key={row.criterion} className="border-t border-[var(--border)]">
              <td className="px-3 py-2 align-top">{row.criterion}</td>
              <td className="px-3 py-2 text-right align-top">
                <span className="font-mono tabular-nums">{shares[index]}%</span>
                <span aria-hidden className="mt-1 block h-1 rounded-full bg-[var(--border)]">
                  <span
                    className="motion-grow-x block h-full rounded-full bg-brand-500"
                    style={{ width: `${shares[index]}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
