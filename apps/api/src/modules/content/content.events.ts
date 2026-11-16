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
