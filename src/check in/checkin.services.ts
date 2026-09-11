import {NotFoundException,ConflictException, Injectable} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CheckInDto } from './dto/checkin.dto';


@Injectable()
export class CheckInService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(qrToken: string, scannedById?: string) {
    const pass = await this.prisma.pass.findUnique({
      where: {
        qrToken,
      },
      include: {
        attendee: true,
        event: true,
        checkIn: true,
      },
    });

    if (!pass) {
      throw new NotFoundException('Invalid QR code');
    }

    // Prevent the same pass from being checked in twice
    if (pass.checkIn) {
      throw new ConflictException({
        message: 'Pass already checked in',
        code: 'ALREADY_USED',
        attendee: pass.attendee,
        scannedAt: pass.checkIn.scannedAt,
      });
    }

    const checkIn = await this.prisma.checkIn.create({
      data: {
        passId: pass.id,
        scannedById,
      },
    });

    return {
      message: 'Check-in successful',
      checkIn,
      attendee: pass.attendee,
      event: pass.event,
    };
  }
}