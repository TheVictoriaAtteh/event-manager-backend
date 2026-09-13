
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';
import * as QRCode from 'qrcode';
import { PassPdfService } from './pass-pdf.services';
import { EmailService } from '../email/email.service';

@Injectable()
export class PassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly passPdfService: PassPdfService,
  ) {}

  verifyPass(qrToken: string) {
    throw new Error('Method not implemented.');
  }

  async createPass(attendeeId: string) {
    // Find attendee and their event
    const attendee = await this.prisma.attendee.findUnique({
      where: {
        id: attendeeId,
      },
      include: {
        event: {
          include: {
            hall: true,
          },
        },
      },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    // A hall must be assigned before generating a pass
    if (!attendee.event.hall) {
      throw new BadRequestException(
        'A hall must be assigned to this event before generating a pass',
      );
    }

    // Generate a unique QR token
    const qrToken = randomUUID();

    // Information encoded inside the QR code
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
        },
      },
    };

    // Generate QR code
    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1000,
    });

    // Create the pass in the database
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

    // Generate the PDF using the newly created pass
    const pdfBuffer = await this.passPdfService.generatePassPdf(pass.id);

    // Send the PDF pass to the attendee's email
    await this.emailService.sendEmail(
      attendee.email,
      `Your Event Pass - ${attendee.event.title}`,
      `
        <h2>Your event pass is ready</h2>

        <p>Hello ${attendee.name},</p>

        <p>
          Your registration for
          <strong>${attendee.event.title}</strong>
          has been confirmed.
        </p>

        <p>
          Your event pass is attached to this email.
          Please keep it available for check-in.
        </p>

        <p>
          We look forward to seeing you at the event.
        </p>
      `,
      [
        {
          filename: `event-pass-${pass.id}.pdf`,
          content: pdfBuffer,
        },
      ],
    );

    return {
      passId: pass.id,
      qrToken: pass.qrToken,
      qrCode,
      qrData,
    };
  }
}