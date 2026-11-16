import type { ExerciseView } from '@hub/shared';
import { LinkSubmitForm } from './LinkSubmitForm';

type Project = NonNullable<ExerciseView['project']>;

/** Project exercise: the rubric the mentor will use, then the link form (INFORMATION-ARCHITECTURE §6). */
export function ProjectPanel({ exerciseId, project }: { exerciseId: string; project: Project }) {
  const githubOnly = project.deliverable === 'github_repo_or_pr';
  return (
    <div className="space-y-5 text-sm">
      {project.rubric.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="mb-2 text-left font-semibold">Tiêu chí chấm</caption>
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tiêu chí
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Trọng số
                </th>
              </tr>
            </thead>
            <tbody>
              {project.rubric.map((row) => (
                <tr key={row.criterion} className="border-b border-[var(--border)]">
                  <td className="py-2 pr-3">{row.criterion}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{row.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LinkSubmitForm
        exerciseId={exerciseId}
        urlLabel={githubOnly ? 'URL repo hoặc pull request trên GitHub' : 'Đường dẫn sản phẩm'}
        urlPlaceholder={githubOnly ? 'https://github.com/ten-ban/du-an' : 'https://…'}
      />
    </div>
  );
}
