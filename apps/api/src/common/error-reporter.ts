/**
 * Port the global exception filter uses to report 500s (E11). The notifications module
 * binds it to the Discord alert channel; without a binding the filter only logs.
 */
export interface ServerErrorReport {
  method: string;
  /** req.originalUrl; the reporter drops the query string */
  url: string;
  requestId?: string;
  error: unknown;
}

export interface ErrorReporter {
  /** Fire-and-forget: must return at once and never throw. */
  report(report: ServerErrorReport): void;
}

export const ERROR_REPORTER = Symbol('ERROR_REPORTER');
