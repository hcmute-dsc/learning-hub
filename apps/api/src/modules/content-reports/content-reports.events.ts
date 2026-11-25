import type { ContentReportStatus } from '@hub/shared';

/**
 * Domain events of content reports (learning-hub#121). The audit listener records status
 * changes and created issues; the inbox listener tells the reporter when a report closes.
 * No report text in them: only ids, titles and statuses.
 */
export const ContentReportEvents = {
  StatusChanged: 'content_report.status_changed',
  IssueCreated: 'content_report.issue_created',
} as const;

export interface ContentReportStatusChangedEvent {
  actorId: string;
  reportId: string;
  reporterId: string;
  trackSlug: string;
  from: ContentReportStatus;
  to: ContentReportStatus;
  /** true when the reporter should hear back (notifiesReporter) */
  notifyReporter: boolean;
  /** what was reported, for the reporter's bell */
  targetTitle: string;
  /** path inside the web app */
  targetLink: string;
}

export interface ContentReportIssueCreatedEvent {
  actorId: string;
  reportId: string;
  trackSlug: string;
  repo: string;
  issueUrl: string;
}
