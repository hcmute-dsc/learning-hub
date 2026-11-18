import { describe, expect, it } from 'vitest';
import { isFiltered, parseQueueFilter, queueQuery } from './queue-filter';

describe('parseQueueFilter', () => {
  it('reads a track slug and a GitHub login', () => {
    expect(parseQueueFilter({ track: 'sql-30-days', mentee: 'Tien-NHM' })).toEqual({
      track: 'sql-30-days',
      mentee: 'Tien-NHM',
    });
  });

  it('treats missing or empty values as "all"', () => {
    expect(parseQueueFilter({})).toEqual({ track: null, mentee: null });
    expect(parseQueueFilter({ track: '', mentee: '  ' })).toEqual({ track: null, mentee: null });
  });

  it('drops values the API would reject instead of failing the page', () => {
    expect(parseQueueFilter({ track: 'SQL 30', mentee: '-bad-' })).toEqual({
      track: null,
      mentee: null,
    });
    expect(parseQueueFilter({ mentee: 'a'.repeat(40) }).mentee).toBeNull();
    expect(parseQueueFilter({ track: 'a'.repeat(81) }).track).toBeNull();
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseQueueFilter({ track: ['python', 'sql'] }).track).toBe('python');
  });
});

describe('queueQuery', () => {
  it('builds the query string, empty when not filtered', () => {
    expect(queueQuery({ track: null, mentee: null })).toBe('');
    expect(queueQuery({ track: 'python', mentee: null })).toBe('?track=python');
    expect(queueQuery({ track: 'python', mentee: 'an' })).toBe('?track=python&mentee=an');
  });
});

describe('isFiltered', () => {
  it('is true when any filter is set', () => {
    expect(isFiltered({ track: null, mentee: null })).toBe(false);
    expect(isFiltered({ track: null, mentee: 'an' })).toBe(true);
  });
});
