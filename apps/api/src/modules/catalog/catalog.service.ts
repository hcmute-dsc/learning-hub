import { Injectable } from '@nestjs/common';
import type { Paginated, TrackListQuery, TrackSummary } from '@hub/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DomainError } from '../../common/errors';
import { toTrackDetail, toTrackSummary } from './catalog-views';

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
      data: tracks.map(toTrackSummary),
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
        contentVersion: { select: { commitSha: true, sourceRepo: true, trackSources: true } },
      },
    });
    if (!track || track.status !== 'active') throw DomainError.notFound('Track');
    const published = await this.prisma.contentVersion.findFirst({
      where: { status: 'published' },
      select: { commitSha: true, sourceRepo: true, trackSources: true },
    });
    return toTrackDetail(track, published);
  }
}
