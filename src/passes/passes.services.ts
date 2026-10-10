
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

        <p>Hello ${this.escapeHtml(attendee.name)},</p>

        <p>
          Your registration for
          <strong>${this.escapeHtml(attendee.event.title)}</strong>
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

  async emailPaidOrderPass(paymentOrderId: string): Promise<void> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      include: {
        ticketType: true,
        attendees: {
          include: {
            pass: {
              include: {
                attendee: { include: { event: true } },
              },
            },
          },
        },
      },
    });

    if (!order || order.status !== 'PAID' || order.attendees.length !== order.quantity) {
      throw new NotFoundException('Paid ticket pass not found');
    }
    if (order.emailSentAt) {
      return;
    }

    for (const recipient of order.attendees) {
      if (recipient.emailSentAt) {
        continue;
      }
      if (!recipient.pass) {
        throw new ConflictException('A paid ticket is missing its QR pass');
      }

      const claimedAt = new Date();
      const claim = await this.prisma.paymentOrderAttendee.updateMany({
        where: {
          id: recipient.id,
          emailSentAt: null,
          OR: [
            { emailClaimedAt: null },
            {
              emailClaimedAt: {
                lt: new Date(claimedAt.getTime() - 5 * 60_000),
              },
            },
          ],
        },
        data: { emailClaimedAt: claimedAt },
      });
      if (claim.count === 0) {
        continue;
      }

      try {
        const pass = recipient.pass;
        const attendee = pass.attendee;
        const pdfBuffer = await this.passPdfService.generatePassPdf(pass.id);
        await this.emailService.sendEmail(
          recipient.email,
          `Your ${attendee.event.title} ticket`,
          `
            <h2>Your ticket is confirmed</h2>
            <p>Hello ${this.escapeHtml(attendee.name)},</p>
            <p>Your payment is confirmed for <strong>${this.escapeHtml(attendee.event.title)}</strong>.</p>
            <p>Your ${this.escapeHtml(order.ticketType.name)} ticket is attached. Present its QR code at check-in.</p>
          `,
          [{ filename: `event-ticket-${pass.id}.pdf`, content: pdfBuffer }],
        );
        await this.prisma.paymentOrderAttendee.update({
          where: { id: recipient.id },
          data: { emailSentAt: new Date(), emailClaimedAt: null },
        });
      } catch (error) {
        await this.prisma.paymentOrderAttendee.update({
          where: { id: recipient.id },
          data: { emailClaimedAt: null },
        });
        throw error;
      }
    }

    const undelivered = await this.prisma.paymentOrderAttendee.count({
      where: { paymentOrderId: order.id, emailSentAt: null },
    });
    if (undelivered === 0) {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'PAID', emailSentAt: null },
        data: { emailSentAt: new Date(), emailClaimedAt: null },
      });
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] ?? character;
    });
  }
}