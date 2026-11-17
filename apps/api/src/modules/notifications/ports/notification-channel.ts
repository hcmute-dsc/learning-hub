/**
 * Port owned by the notifications module (E9/E11). The module builds plain text;
 * an adapter (integrations/discord) delivers it. Swapping Discord for another chat
 * app means writing a new adapter, not touching the listeners.
 */
export interface NotificationChannel {
  /** false when no destination is configured: callers skip the work of building a message */
  readonly enabled: boolean;
  /** Deliver one message. Never throws: delivery problems are logged by the adapter. */
  send(content: string): Promise<void>;
}

/** Club channel: submissions waiting for review, finished reviews, new content (E9). */
export const CLUB_CHANNEL = Symbol('CLUB_CHANNEL');
/** Ops channel for the tech team: server errors (E11). */
export const ALERT_CHANNEL = Symbol('ALERT_CHANNEL');

/** Used when the webhook URL is empty, so notifications are simply off. */
export class NoopChannel implements NotificationChannel {
  readonly enabled = false;
  async send(): Promise<void> {}
}
