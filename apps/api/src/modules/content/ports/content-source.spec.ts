import { toTrackSources } from './content-source';

describe('toTrackSources', () => {
  const sql = { repo: 'hcmute-dsc/learning-hub-track-sql-30-days', commitSha: 'a'.repeat(40) };

  it('reads the track_sources JSON of a registry version', () => {
    expect(toTrackSources({ 'sql-30-days': sql })).toEqual({ 'sql-30-days': sql });
  });

  it('is null for a version without a registry, and drops broken entries', () => {
    expect(toTrackSources(null)).toBeNull();
    expect(toTrackSources(undefined)).toBeNull();
    expect(toTrackSources([sql])).toBeNull();
    expect(toTrackSources({ broken: { repo: 1 }, empty: null })).toBeNull();
    expect(toTrackSources({ 'sql-30-days': sql, broken: { repo: 'x' } })).toEqual({
      'sql-30-days': sql,
    });
  });
});
