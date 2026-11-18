import { Injectable } from '@nestjs/common';
import type { Paginated, TrackLevel, TrackListQuery, TrackSummary } from '@hub/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainError } from '../../common/errors';

/** Read side of published content (BACKEND-DESIGN §2 catalog). Writes come from `content`. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listTracks(query: TrackListQuery): Promise<Paginated<TrackSummary>> {
    const where: Prisma.TrackWhereInput = {
      status: 'active',
      ...(query.level ? { level: query.level } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { summary: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, tracks] = await this.prisma.$transaction([
      this.prisma.track.count({ where }),
      this.prisma.track.findMany({
        where,
        orderBy: [{ position: 'asc' }, { title: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          modules: {
            where: { status: 'active' },
            select: {
              _count: {
                select: {
                  lessons: { where: { status: 'active' } },
                  exercises: { where: { status: 'active' } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: tracks.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        level: t.level as TrackLevel,
        language: t.language,
        estHours: t.estHours,
        tags: t.tags,
        lessonCount: t.modules.reduce((n, m) => n + m._count.lessons, 0),
        exerciseCount: t.modules.reduce((n, m) => n + m._count.exercises, 0),
      })),
      page: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async getTrack(slug: string) {
    const track = await this.prisma.track.findUnique({
      where: { slug },
      include: {
        modules: {
          where: { status: 'active' },
          orderBy: { position: 'asc' },
          include: {
            lessons: {
              where: { status: 'active' },
              orderBy: { position: 'asc' },
              select: { id: true, slug: true, title: true, estMinutes: true },
            },
            exercises: {
              where: { status: 'active' },
              orderBy: { position: 'asc' },
              select: { id: true, slug: true, title: true, type: true, difficulty: true },
            },
          },
        },
        contentVersion: { select: { commitSha: true, sourceRepo: true } },
      },
    });
    if (!track || track.status !== 'active') throw DomainError.notFound('Track');
    // track.contentVersion is the version that last wrote the track row, so it stays old
    // when a publish only changes lessons (the page showed ea5de5c after 95a1924 went live,
    // 18/11/2026). Show the version members are reading now.
    const source =
      (await this.prisma.contentVersion.findFirst({
        where: { status: 'published' },
        select: { commitSha: true, sourceRepo: true },
      })) ?? track.contentVersion;
    return {
      id: track.id,
      slug: track.slug,
      title: track.title,
      summary: track.summary,
      level: track.level,
      language: track.language,
      estHours: track.estHours,
      tags: track.tags,
      starterRepo: track.starterRepo,
      source: {
        repo: source.sourceRepo,
        commitSha: source.commitSha,
        path: track.sourcePath,
      },
      modules: track.modules.map((m) => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        summary: m.summary,
        lessons: m.lessons,
        exercises: m.exercises,
      })),
    };
  }
}
