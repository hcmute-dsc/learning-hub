import { describe, expect, it } from 'vitest';
import { CONTRIBUTE_LINKS, labelledIssuesUrl, newIssueUrl, trackRepo } from './contribute';

describe('contribute links', () => {
  it('names the repo of a track by the ADR-10 convention', () => {
    expect(trackRepo('sql-30-days')).toBe('hcmute-dsc/learning-hub-track-sql-30-days');
  });

  it('refuses a slug that could not be a track repo', () => {
    expect(() => trackRepo('../learning-hub')).toThrow(/invalid track slug/);
    expect(() => trackRepo('SQL')).toThrow(/invalid track slug/);
  });

  it('opens the issue form of a repo', () => {
    expect(newIssueUrl('hcmute-dsc/learning-hub-track-sql-30-days', 'content_bug.yml')).toBe(
      'https://github.com/hcmute-dsc/learning-hub-track-sql-30-days/issues/new?template=content_bug.yml',
    );
  });

  it('filters open issues by a label with spaces', () => {
    expect(labelledIssuesUrl('hcmute-dsc/learning-hub', 'good first issue')).toBe(
      'https://github.com/hcmute-dsc/learning-hub/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22',
    );
  });

  it('sends new-track proposals to the registry and code to the app repo', () => {
    expect(CONTRIBUTE_LINKS.proposeTrack).toBe(
      'https://github.com/hcmute-dsc/learning-hub-content/issues/new?template=content_proposal.yml',
    );
    expect(CONTRIBUTE_LINKS.appContributing).toBe(
      'https://github.com/hcmute-dsc/learning-hub/blob/main/CONTRIBUTING.md',
    );
  });
});
