
import {
  Injectable, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';
import { PassPdfService } from './pass-pdf.services';
import { EmailService } from '../email/email.service';
import { CheckInService } from '../check-in/check-in.service';
@Injectable()
export class PassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly passPdfService: PassPdfService,
    private readonly checkInService: CheckInService,

  ) {}

  async verifyPass(qrToken: string) {
    return this.checkInService.checkIn(qrToken);
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
    };
  }
}