/** Domain events published by the users module (BACKEND-DESIGN §5). */
export const UserEvents = {
  Registered: 'user.registered',
  Approved: 'user.approved',
  RolesChanged: 'user.roles_changed',
  ApprovedEmailsChanged: 'user.approved_emails_changed',
  Suspended: 'user.suspended',
  Reactivated: 'user.reactivated',
  DiscordLinked: 'user.discord_linked',
  DiscordUnlinked: 'user.discord_unlinked',
} as const;

/** A member linked (or unlinked) their Discord account from /settings (learning-hub#76). */
export interface DiscordLinkEvent {
  userId: string;
  discordUsername: string;
}

export interface RolesChangedEvent {
  actorId: string;
  userId: string;
  roles: string[];
  previousRoles: string[];
}

export interface UserSuspendedEvent {
  actorId: string;
  userId: string;
  previousStatus: string;
}

export interface UserReactivatedEvent {
  actorId: string;
  userId: string;
}
