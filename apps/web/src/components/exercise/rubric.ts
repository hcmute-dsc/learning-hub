/**
 * Share of each rubric criterion in the total weight, as whole percents, for the
 * project rubric table (ProjectPanel.tsx). Weights are relative numbers in the content
 * repo, so "2, 1, 1" reads as "50%, 25%, 25%". A rubric without weight gives zeros.
 */
export function rubricShares(rubric: { weight: number }[]): number[] {
  let total = 0;
  for (const row of rubric) total += Math.max(0, row.weight);

  const shares: number[] = [];
  for (const row of rubric) {
    shares.push(total === 0 ? 0 : Math.round((Math.max(0, row.weight) / total) * 100));
  }
  return shares;
}
