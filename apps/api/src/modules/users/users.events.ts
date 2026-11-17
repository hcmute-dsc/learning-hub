/** Domain events published by the users module (BACKEND-DESIGN §5). */
export const UserEvents = {
  Registered: 'user.registered',
  Approved: 'user.approved',
  RolesChanged: 'user.roles_changed',
  ApprovedEmailsChanged: 'user.approved_emails_changed',
  Suspended: 'user.suspended',
  Reactivated: 'user.reactivated',
} as const;

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
