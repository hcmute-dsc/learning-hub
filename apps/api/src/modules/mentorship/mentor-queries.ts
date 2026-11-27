/** Prisma fragments shared by the mentorship services. */

export const PERSON = { id: true, githubLogin: true, displayName: true, avatarUrl: true } as const;

/** Who counts as a mentor today: active, not deleted, still holding the mentor role. */
export const CURRENT_MENTOR = {
  status: 'active',
  deletedAt: null,
  roles: { some: { role: { code: 'mentor' } } },
};
