import type { Role } from '@hub/shared';

/** Fixed role ids, seeded by prisma/seed.ts (DATABASE §3.2). */
export const ROLE_IDS: Record<Role, number> = {
  member: 1,
  mentor: 2,
  content_maintainer: 3,
  admin: 4,
};
