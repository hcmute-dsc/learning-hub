/**
 * Local seed: fixed roles + a small demo track so the UI has something to show.
 * Real content comes from learning-hub-content via the content sync (E3), not from here.
 */
import '../src/load-env';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const ROLES = [
  { id: 1, code: 'member', description: 'Thành viên: học, nộp bài' },
  { id: 2, code: 'mentor', description: 'Mentor: review bài, nhận mentee' },
  { id: 3, code: 'content_maintainer', description: 'Duy trì nội dung, yêu cầu sync' },
  { id: 4, code: 'admin', description: 'Ban chủ nhiệm / quản trị' },
];

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

// Fixed ids so re-running the seed is idempotent.
const VERSION_ID = '01936000-0000-7000-8000-000000000001';
const DEMO = {
  sourceRepo: 'hcmute-dsc/learning-hub-content',
  commitSha: '0000000000000000000000000000000000000000',
};

const TRACKS = [
  {
    id: '01936000-0000-7000-8000-000000000101',
    slug: 'sql-30-days',
    title: '30 ngày học SQL',
    summary: 'Từ SELECT cơ bản tới index, transaction và window function với PostgreSQL 16.',
    level: 'beginner',
    estHours: 30,
    position: 10,
    tags: ['sql', 'postgresql', 'database'],
    modules: [
      {
        id: '01936000-0000-7000-8000-000000000201',
        slug: 'foundations',
        title: 'Nền tảng và truy vấn đơn giản',
        lessons: [
          [
            '01936000-0000-7000-8000-000000000301',
            'intro-to-sql',
            'Giới thiệu SQL và môi trường thực hành',
            30,
          ],
          [
            '01936000-0000-7000-8000-000000000302',
            'select-where',
            'SELECT và WHERE: truy vấn và lọc dữ liệu',
            40,
          ],
        ],
        exercises: [
          [
            '01936000-0000-7000-8000-000000000401',
            'select-where-basic',
            'Lọc khách hàng theo thành phố',
            'self_check',
            'easy',
          ],
          [
            '01936000-0000-7000-8000-000000000402',
            'null-logic-quiz',
            'NULL và logic ba trị',
            'quiz',
            'easy',
          ],
        ],
      },
    ],
  },
  {
    id: '01936000-0000-7000-8000-000000000102',
    slug: 'git-github-basics',
    title: 'Làm quen Git & GitHub',
    summary: 'Commit, branch, pull request — nền tảng để nộp bài trên Learning Hub.',
    level: 'beginner',
    estHours: 6,
    position: 5,
    tags: ['git', 'github'],
    modules: [
      {
        id: '01936000-0000-7000-8000-000000000202',
        slug: 'first-steps',
        title: 'Những bước đầu tiên',
        lessons: [
          ['01936000-0000-7000-8000-000000000303', 'what-is-git', 'Git là gì và vì sao cần nó', 20],
        ],
        exercises: [
          [
            '01936000-0000-7000-8000-000000000403',
            'first-pull-request',
            'Mở pull request đầu tiên',
            'code',
            'easy',
          ],
        ],
      },
    ],
  },
] as const;

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({ where: { id: role.id }, update: role, create: role });
  }

  await prisma.contentVersion.upsert({
    where: { id: VERSION_ID },
    update: {},
    create: {
      id: VERSION_ID,
      ...DEMO,
      status: 'published',
      summary: { seed: true },
      publishedAt: new Date(),
    },
  });

  for (const t of TRACKS) {
    const { modules, ...track } = t;
    const data = {
      ...track,
      tags: [...track.tags],
      contentVersionId: VERSION_ID,
      sourcePath: `tracks/${t.slug}/track.yaml`,
      contentHash: hash(JSON.stringify(track)),
    };
    await prisma.track.upsert({ where: { id: t.id }, update: data, create: data });

    for (const [mi, m] of modules.entries()) {
      const mod = {
        id: m.id,
        trackId: t.id,
        slug: m.slug,
        title: m.title,
        position: mi + 1,
        contentVersionId: VERSION_ID,
        sourcePath: `tracks/${t.slug}/modules/${m.slug}/module.yaml`,
        contentHash: hash(m.title),
      };
      await prisma.module.upsert({ where: { id: m.id }, update: mod, create: mod });

      for (const [li, [id, slug, title, est]] of m.lessons.entries()) {
        const lesson = {
          id,
          moduleId: m.id,
          slug,
          title,
          estMinutes: est,
          position: li + 1,
          bodyMd: `# ${title}\n\nNội dung demo. Bài thật được đồng bộ từ learning-hub-content.`,
          contentVersionId: VERSION_ID,
          sourcePath: `tracks/${t.slug}/modules/${m.slug}/lessons/${slug}.md`,
          contentHash: hash(title),
        };
        await prisma.lesson.upsert({ where: { id }, update: lesson, create: lesson });
      }

      for (const [ei, [id, slug, title, type, difficulty]] of m.exercises.entries()) {
        const exercise = {
          id,
          moduleId: m.id,
          slug,
          title,
          type,
          difficulty,
          position: ei + 1,
          statementMd: `## ${title}\n\nĐề bài demo.`,
          requiresReview: type === 'project',
          contentVersionId: VERSION_ID,
          sourcePath: `tracks/${t.slug}/modules/${m.slug}/exercises/${slug}/exercise.yaml`,
          contentHash: hash(title),
        };
        await prisma.exercise.upsert({ where: { id }, update: exercise, create: exercise });
      }
    }
  }
  console.log(`Seeded ${ROLES.length} roles and ${TRACKS.length} demo tracks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
