import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { LessonStatus } from '@hub/shared';

/** The only code that reads or writes the `lesson_progress` table (DATABASE §3.11). */
@Injectable()
export class LessonProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** lessonId → status for the given lessons; lessons without a row are left out. */
  async statusesFor(userId: string, lessonIds: string[]): Promise<Map<string, LessonStatus>> {
    if (!lessonIds.length) return new Map();
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds } },
      select: { lessonId: true, status: true },
    });
    const map = new Map<string, LessonStatus>();
    for (const row of rows) map.set(row.lessonId, row.status as LessonStatus);
    return map;
  }

  async statusOf(userId: string, lessonId: string): Promise<LessonStatus> {
    return (await this.statusesFor(userId, [lessonId])).get(lessonId) ?? 'not_started';
  }

  /** When each lesson the member has completed was completed (member profile activity). */
  async completedAtFor(userId: string): Promise<Date[]> {
    const rows = await this.prisma.lessonProgress.findMany({
      where: { userId, status: 'completed', completedAt: { not: null } },
      select: { completedAt: true },
    });
    return rows.map((r) => r.completedAt!);
  }

  /** userId → when they last touched any lesson (mentor dashboard: inactive mentees). */
  async lastActivityFor(userIds: string[]): Promise<{ userId: string; at: Date | null }[]> {
    if (!userIds.length) return [];
    const rows = await this.prisma.lessonProgress.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _max: { updatedAt: true },
    });
    return rows.map((r) => ({ userId: r.userId, at: r._max.updatedAt }));
  }

  /** completed_at records when the lesson was completed; it is cleared if the member reopens it. */
  async save(
    userId: string,
    lessonId: string,
    status: 'in_progress' | 'completed',
    now: Date,
  ): Promise<void> {
    const completedAt = status === 'completed' ? now : null;
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, status, completedAt },
      update: { status, completedAt },
    });
  }
}
