import { describe, expect, it } from 'vitest';
import { rubricShares } from './rubric';

describe('rubricShares', () => {
  it('turns relative weights into percents', () => {
    expect(rubricShares([{ weight: 2 }, { weight: 1 }, { weight: 1 }])).toEqual([50, 25, 25]);
  });

  it('gives zeros when nothing has weight', () => {
    expect(rubricShares([{ weight: 0 }, { weight: 0 }])).toEqual([0, 0]);
    expect(rubricShares([])).toEqual([]);
  });

  it('ignores negative weights', () => {
    expect(rubricShares([{ weight: -1 }, { weight: 3 }])).toEqual([0, 100]);
  });
});
