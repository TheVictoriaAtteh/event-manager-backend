import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface CheckInResult {
  success: boolean;
  message: string;
  checkIn: {
    id: string;
    scannedAt: Date;
    attendee: {
      id: string;
      name: string;
      email: string;
      passType: string;
    };
    event: {
      id: string;
      title: string;
    };
    scannedBy: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
}

export interface CheckInLogRecord {
  id: string;
  scannedAt: Date;
  passId: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    passType: string;
  };
  scannedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

@Injectable()
export class CheckInService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a check-in by scanning an attendee's pass UUID.
   * Enforces pass validity, non-revocation, event authorization, and duplicate prevention.
   */
  async scanPass(passId: string, scannedById: string): Promise<CheckInResult> {
    const pass = await this.prisma.pass.findUnique({
      where: { id: passId },
      include: {
        attendee: {
          include: {
            event: true,
          },
        },
        checkIn: true,
      },
    });

    if (!pass) {
      throw new NotFoundException({
        message: 'Invalid or unknown pass code',
        code: 'PASS_NOT_FOUND',
      });
    }

    if (pass.revokedAt) {
      throw new BadRequestException({
        message: 'This pass has been revoked and cannot be used for entry',
        code: 'PASS_REVOKED',
      });
    }

    // Verify staff/admin authorization for this event
    const scannedBy = await this.prisma.user.findUnique({
      where: { id: scannedById },
      select: { id: true, name: true, email: true, role: true },
    });

    if (
      !scannedBy ||
      (scannedBy.role !== UserRole.ADMIN &&
        pass.attendee.event.organizerId !== scannedById)
    ) {
      throw new ForbiddenException({
        message: 'You are not authorized to perform check-ins for this event',
        code: 'UNAUTHORIZED_CHECKIN',
      });
    }

    if (pass.checkIn) {
      throw new ConflictException({
        message: `Attendee "${pass.attendee.name}" has already checked in`,
        code: 'ALREADY_CHECKED_IN',
        scannedAt: pass.checkIn.scannedAt,
      });
    }

    const checkIn = await this.prisma.checkIn.create({
      data: {
        passId,
        scannedById,
      },
      include: {
        pass: {
          include: {
            attendee: {
              include: {
                event: true,
              },
            },
          },
        },
        scannedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      success: true,
      message: `Successfully checked in ${checkIn.pass.attendee.name}`,
      checkIn: {
        id: checkIn.id,
        scannedAt: checkIn.scannedAt,
        attendee: {
          id: checkIn.pass.attendee.id,
          name: checkIn.pass.attendee.name,
          email: checkIn.pass.attendee.email,
          passType: checkIn.pass.attendee.passType,
        },
        event: {
          id: checkIn.pass.attendee.event.id,
          title: checkIn.pass.attendee.event.title,
        },
        scannedBy: checkIn.scannedBy,
      },
    };
  }

  /**
   * Retrieves all check-in log entries for a given event, sorted newest first.
   */
  async getEventCheckIns(
    eventId: string,
    userId: string,
  ): Promise<CheckInLogRecord[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizerId: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || (user.role !== UserRole.ADMIN && event.organizerId !== userId)) {
      throw new ForbiddenException(
        'You do not have access to view check-ins for this event',
      );
    }

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        pass: {
          attendee: {
            eventId,
          },
        },
      },
      orderBy: { scannedAt: 'desc' },
      include: {
        pass: {
          include: {
            attendee: true,
          },
        },
        scannedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return checkIns.map((ci) => ({
      id: ci.id,
      scannedAt: ci.scannedAt,
      passId: ci.passId,
      attendee: {
        id: ci.pass.attendee.id,
        name: ci.pass.attendee.name,
        email: ci.pass.attendee.email,
        passType: ci.pass.attendee.passType,
      },
      scannedBy: ci.scannedBy,
    }));
  }
}

