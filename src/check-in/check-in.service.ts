import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async checkIn(
    qrToken: string,
    scannedById?: string,
  ) {
    // 1. Find the pass using the QR token
    const pass = await this.prisma.pass.findUnique({
      where: {
        qrToken,
      },
      include: {
        attendee: {
          include: {
            event: {
              include: {
                hall: true,
              },
            },
          },
        },
        checkIn: true,
      },
    });

    // 2. QR token doesn't belong to any pass
    if (!pass) {
      throw new NotFoundException(
        'Invalid QR code',
      );
    }

    // 3. Check whether the pass has been revoked
    if (pass.revokedAt) {
      throw new BadRequestException(
        'This pass has been revoked',
      );
    }

    // 4. Check whether this pass has already been used
    if (pass.checkIn) {
      throw new BadRequestException(
        'This pass has already been checked in',
      );
    }

    // 5. Create the check-in record
    const checkIn = await this.prisma.checkIn.create({
      data: {
        passId: pass.id,
        scannedById,
      },
    });

    // 6. Return useful information to the scanner
    return {
      message: 'Check-in successful',
      checkInId: checkIn.id,
      scannedAt: checkIn.scannedAt,

      attendee: {
        id: pass.attendee.id,
        name: pass.attendee.name,
        email: pass.attendee.email,
        
      },

      event: {
        id: pass.attendee.event.id,
        title: pass.attendee.event.title,
        date: pass.attendee.event.date,
        startsAt: pass.attendee.event.startsAt,
        endsAt: pass.attendee.event.endsAt,
      },

      hall: pass.attendee.event.hall
        ? {
            id: pass.attendee.event.hall.id,
            name: pass.attendee.event.hall.name,
            address: pass.attendee.event.hall.address,
          }
        : null,
    };
  }
}