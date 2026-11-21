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

/**
 * A rich post on the club channel (learning-hub#76): text, embeds, and the only
 * accounts that may be pinged. Unlike NotificationChannel.send, `post` THROWS when the
 * post did not go through, so the outbox retries it later.
 */
export interface ClubPost {
  content: string;
  embeds: object[];
  /** Discord ids allowed to be pinged; nothing else is (no @everyone, no roles) */
  mentionUserIds: string[];
}

export interface ClubPoster {
  /** false when no club webhook is configured */
  readonly enabled: boolean;
  /** Post; returns the Discord message id (null when Discord gave none). Throws on failure. */
  post(message: ClubPost): Promise<{ messageId: string | null }>;
  /** Edit a message posted earlier (learning-hub#83). Throws ClubPostGoneError on 404. */
  edit(messageId: string, message: ClubPost): Promise<void>;
}

/** The message to edit no longer exists on Discord (deleted by a moderator). */
export class ClubPostGoneError extends Error {
  constructor() {
    super('The Discord message was deleted');
    this.name = 'ClubPostGoneError';
  }
}

export const CLUB_POSTER = Symbol('CLUB_POSTER');

export class NoopPoster implements ClubPoster {
  readonly enabled = false;
  async post(): Promise<{ messageId: string | null }> {
    return { messageId: null };
  }
  async edit(): Promise<void> {}
}
