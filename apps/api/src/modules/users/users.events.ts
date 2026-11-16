/** Domain events published by the users module (BACKEND-DESIGN §5). */
export const UserEvents = {
  Registered: 'user.registered',
  Approved: 'user.approved',
  RolesChanged: 'user.roles_changed',
  ApprovedEmailsChanged: 'user.approved_emails_changed',
} as const;
