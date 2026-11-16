import type { ProblemDetails } from '@hub/shared';
import { ERROR_MESSAGE } from '@/lib/labels';

/**
 * Shows an API problem+json error (FRONTEND-DESIGN §7). The live region is always in
 * the DOM so screen readers announce the error when it appears.
 */
export function ProblemAlert({ problem }: { problem: ProblemDetails | null }) {
  return (
    <div aria-live="assertive" role="alert">
      {problem && (
        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100">
          <p className="font-semibold">
            <span aria-hidden>⚠ </span>
            {/* status 0 = the request never reached the API; the title already says why */}
            {problem.status === 0 ? problem.title : (ERROR_MESSAGE[problem.code] ?? problem.title)}
          </p>
          {problem.status !== 0 && (
            <p className="mt-1">
              {problem.title}
              {problem.detail ? `: ${problem.detail}` : ''}
            </p>
          )}
          {problem.errors && problem.errors.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {problem.errors.map((e) => (
                <li key={`${e.path}-${e.message}`}>
                  {e.path ? <code>{e.path}</code> : null} {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
