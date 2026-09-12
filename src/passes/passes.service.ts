import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';



@Injectable()
export class PassesService {
  verifyPass(qrToken: string) {
    throw new Error('Method not implemented.');
  }
  constructor(private readonly prisma: PrismaService) {}

  async createPass(attendeeId: string) {
    // this find  attendee aand their event
    const attendee = await this.prisma.attendee.findUnique({
      where: {
        id: attendeeId,
      },
      include: {
        event: {
          include: {
          hall:true,
        }
      }
 },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (!attendee.event.hall) {
  throw new BadRequestException(
    'A hall must be assigned to this event before generating a pass',
  );
}


      // generate a new unique token with a unique QR token
  const qrToken = randomUUID(); 
  const qrData = {
    qrToken, 
    attendee: { 
      id: attendee.id,
      name: attendee.name, 
      email: attendee.email, 
      passType: attendee.passType,
      },
      event: {
      id: attendee.event.id,
      title: attendee.event.title,
      date: attendee.event.date,
      startsAt: attendee.event.startsAt,
      endsAt: attendee.event.endsAt,

    hall: {
      id: attendee.event.hall.id,
      name: attendee.event.hall.name,
      address: attendee.event.hall.address,
      capacity: attendee.event.hall.capacity,
    }
    },
      };
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 1000,
  });

    const pass = await this.prisma.pass.create({
      data: {
        attendeeId: attendee.id,
        qrToken,
      },
      include: {
        attendee: {
          include: {
            event: true,
    },
  },
},
});

    return  {
      passId: pass.id,
      qrToken: pass.qrToken,
      qrCode,
      qrData,
    };
  }
};