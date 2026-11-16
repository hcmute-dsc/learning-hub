import { Injectable } from '@nestjs/common';
import { exerciseIndex, type ContentTree } from '@hub/content';
import type { Prisma } from '@prisma/client';
import type { CatalogChanges, DbSnapshot } from './catalog.types';

type Tx = Prisma.TransactionClient;

/**
 * The only code that writes catalog tables (BACKEND-DESIGN §2: content → CatalogWriter).
 * Always called inside the publish transaction.
 */
@Injectable()
export class CatalogWriter {
  async snapshot(tx: Tx): Promise<DbSnapshot> {
    const pick = {
      id: true,
      slug: true,
      status: true,
      contentHash: true,
      sourcePath: true,
    } as const;
    const [tracks, modules, lessons, exercises] = await Promise.all([
      tx.track.findMany({ select: pick }),
      tx.module.findMany({ select: { ...pick, trackId: true } }),
      tx.lesson.findMany({ select: { ...pick, moduleId: true } }),
      tx.exercise.findMany({ select: { ...pick, moduleId: true } }),
    ]);
    return {
      track: tracks.map((r) => ({ ...r, parentId: null })),
      module: modules.map(({ trackId, ...r }) => ({ ...r, parentId: trackId })),
      lesson: lessons.map(({ moduleId, ...r }) => ({ ...r, parentId: moduleId })),
      exercise: exercises.map(({ moduleId, ...r }) => ({ ...r, parentId: moduleId })),
    };
  }

  async apply(tx: Tx, tree: ContentTree, plan: CatalogChanges, versionId: string): Promise<void> {
    const v = { contentVersionId: versionId };

    // 1. Archive what disappeared (children first). Never hard-delete: members may have submissions.
    await tx.exercise.updateMany({
      where: { id: { in: plan.archive.exercise } },
      data: { status: 'archived' },
    });
    await tx.lesson.updateMany({
      where: { id: { in: plan.archive.lesson } },
      data: { status: 'archived' },
    });
    await tx.module.updateMany({
      where: { id: { in: plan.archive.module } },
      data: { status: 'archived' },
    });
    await tx.track.updateMany({
      where: { id: { in: plan.archive.track } },
      data: { status: 'archived' },
    });

    // 2. Upsert new/changed items, parents before children.
    for (const t of tree.tracks) {
      if (plan.upsert.track.has(t.uid)) {
        const data = {
          slug: t.slug,
          title: t.title,
          summary: t.summary,
          level: t.level,
          language: t.language,
          estHours: t.estHours,
          position: t.position,
          tags: t.tags,
          starterRepo: t.starterRepo,
          status: t.status,
          sourcePath: t.sourcePath,
          contentHash: t.hash,
          ...v,
        };
        await tx.track.upsert({
          where: { id: t.uid },
          create: { id: t.uid, ...data },
          update: data,
        });
      }
      for (const m of t.modules) {
        if (plan.upsert.module.has(m.uid)) {
          const data = {
            trackId: t.uid,
            slug: m.slug,
            title: m.title,
            summary: m.summary,
            position: m.position,
            status: 'active',
            sourcePath: m.sourcePath,
            contentHash: m.hash,
            ...v,
          };
          await tx.module.upsert({
            where: { id: m.uid },
            create: { id: m.uid, ...data },
            update: data,
          });
        }
        for (const l of m.lessons) {
          if (!plan.upsert.lesson.has(l.uid)) continue;
          const data = {
            moduleId: m.uid,
            slug: l.slug,
            title: l.title,
            bodyMd: l.bodyMd,
            estMinutes: l.estMinutes,
            position: l.position,
            status: 'active',
            sourcePath: l.sourcePath,
            contentHash: l.hash,
            ...v,
          };
          await tx.lesson.upsert({
            where: { id: l.uid },
            create: { id: l.uid, ...data },
            update: data,
          });
        }
        const lessonIds = new Map(m.lessons.map((l) => [l.slug, l.uid]));
        for (const e of m.exercises) {
          if (!plan.upsert.exercise.has(e.uid)) continue;
          const data = {
            moduleId: m.uid,
            lessonId: e.lessonSlug ? (lessonIds.get(e.lessonSlug) ?? null) : null,
            slug: e.slug,
            title: e.title,
            type: e.type,
            difficulty: e.difficulty,
            statementMd: e.statementMd,
            spec: e.spec as Prisma.InputJsonValue,
            requiresReview: e.requiresReview,
            position: e.position,
            status: 'active',
            sourcePath: e.sourcePath,
            contentHash: e.hash,
            ...v,
          };
          await tx.exercise.upsert({
            where: { id: e.uid },
            create: { id: e.uid, ...data },
            update: data,
          });
        }
      }
    }

    // 3. Prerequisites mirror the tree exactly for every exercise that is in it.
    const index = exerciseIndex(tree);
    const exerciseIds = [...index.values()].map((e) => e.uid);
    await tx.exercisePrerequisite.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
    const pairs = [...index.values()].flatMap((e) =>
      e.prerequisites.map((ref) => ({
        exerciseId: e.uid,
        requiredExerciseId: index.get(ref)!.uid,
      })),
    );
    if (pairs.length)
      await tx.exercisePrerequisite.createMany({ data: pairs, skipDuplicates: true });
  }
}
