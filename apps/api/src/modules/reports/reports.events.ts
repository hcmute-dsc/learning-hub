import type { ReportTable } from '@hub/shared';

/** A CSV export of /admin/reports (learning-hub#34), written to audit_logs. */
export const ReportEvents = {
  Exported: 'report.exported',
} as const;

export interface ReportExportedEvent {
  actorId: string;
  table: ReportTable;
  /** "YYYY-MM-DD", both included */
  from: string;
  to: string;
  /** null = every track / every cohort */
  track: string | null;
  cohort: string | null;
  anonymized: boolean;
  /** data rows in the file */
  rows: number;
}
