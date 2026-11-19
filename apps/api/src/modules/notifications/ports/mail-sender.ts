/**
 * Port for the email digest (learning-hub#49). The notifications module builds the
 * message; an adapter (integrations/email) delivers it over SMTP.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** link in the List-Unsubscribe header, so mail apps show their own "unsubscribe" button */
  unsubscribeUrl: string;
}

export interface MailSender {
  /** false when SMTP is not configured: the digest is off for everyone */
  readonly enabled: boolean;
  /** Throws when delivery fails, so the outbox can retry it later. */
  send(message: MailMessage): Promise<void>;
}

export const MAIL_SENDER = Symbol('MAIL_SENDER');

/** Used when SMTP_HOST is empty (local dev, tests, a server without email). */
export class NoopMailSender implements MailSender {
  readonly enabled = false;
  async send(): Promise<void> {}
}
