import type { PublishedChanges } from './domain/published-changes';
import type { TrackSources } from './ports/content-source';

/** Domain events published by the content module (BACKEND-DESIGN §5). */
export const ContentEvents = {
  Synced: 'content.synced',
  Published: 'content.published',
  Rejected: 'content.rejected',
} as const;

export interface ContentVersionEvent {
  actorId: string | null;
  versionId: string;
  commitSha: string;
  status: string;
}

/** ContentEvents.Published also says what changed, for people (Discord). */
export interface ContentPublishedEvent extends ContentVersionEvent {
  /** owner/repo on GitHub, or local:… in development */
  sourceRepo: string;
  /** the commit that was live before this publish, if any */
  previousCommitSha: string | null;
  /** registry only (ADR-10): the repo and commit of each track, now and before this publish */
  trackSources: TrackSources | null;
  previousTrackSources: TrackSources | null;
  changes: PublishedChanges;
}
