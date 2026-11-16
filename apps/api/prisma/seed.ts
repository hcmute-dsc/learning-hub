/**
 * Seed only what the app needs to boot: the fixed roles (DATABASE §3.2).
 * Learning content is NOT seeded: it comes from a content source via
 *   pnpm --filter @hub/api content:sync -- --publish
 * (locally CONTENT_SOURCE=local reads ../../content-example).
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROLES = [
  { id: 1, code: 'member', description: 'Thành viên: học, nộp bài' },
  { id: 2, code: 'mentor', description: 'Mentor: review bài, nhận mentee' },
  { id: 3, code: 'content_maintainer', description: 'Duy trì nội dung, yêu cầu sync' },
  { id: 4, code: 'admin', description: 'Ban chủ nhiệm / quản trị' },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { id: role.id }, update: role, create: role });
  }
  console.log(`Seeded ${ROLES.length} roles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
