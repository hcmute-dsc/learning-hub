import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../infrastructure/prisma/errors';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { newId } from '../../infrastructure/ids';

export interface EnrollmentRow {
  id: string;
  trackId: string;
  status: string;
  cohort: string | null;
  enrolledAt: Date;
  completedAt: Date | null;
}

const columns = {
  id: true,
  trackId: true,
  status: true,
  cohort: true,
  enrolledAt: true,
  completedAt: true,
} as const;

/** The only code that reads or writes the `enrollments` table (DATABASE §3.10). */
@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(userId: string, trackId: string): Promise<EnrollmentRow | null> {
    return this.prisma.enrollment.findUnique({
      where: { userId_trackId: { userId, trackId } },
      select: columns,
    });
  }

  /** Active and completed enrollments, oldest first; dropped ones are hidden. */
  listVisible(userId: string): Promise<EnrollmentRow[]> {
    return this.prisma.enrollment.findMany({
      where: { userId, status: { in: ['active', 'completed'] } },
      orderBy: { enrolledAt: 'asc' },
      select: columns,
    });
  }

  /**
   * Insert a new active enrollment. Returns null when a concurrent request inserted the
   * same (user, track) first: the unique key makes enrolling idempotent (BACKEND-DESIGN §3.7).
   */
  async insert(
    userId: string,
    trackId: string,
    cohort: string | null,
  ): Promise<EnrollmentRow | null> {
    try {
      return await this.prisma.enrollment.create({
        data: { id: newId(), userId, trackId, cohort, status: 'active' },
        select: columns,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  /** A dropped enrollment comes back as active (DATABASE §8: dropped instead of deleted). */
  reactivate(id: string, cohort: string | null): Promise<EnrollmentRow> {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status: 'active', cohort, completedAt: null },
      select: columns,
    });
  }

  markCompleted(id: string, at: Date): Promise<EnrollmentRow> {
    return this.prisma.enrollment.update({
      where: { id },
      data: { status: 'completed', completedAt: at },
      select: columns,
    });
  }
}
