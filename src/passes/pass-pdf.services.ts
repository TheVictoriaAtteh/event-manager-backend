import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import PDFDocument from 'pdfkit';

import { PrismaService } from '../database/prisma.service';

import * as QRCode from 'qrcode';

@Injectable()
export class PassPdfService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generatePassPdf(
    passId: string,
  ): Promise<Buffer> {
    // Find the pass and all information needed
    const pass = await this.prisma.pass.findUnique({
      where: {
        id: passId,
      },

      include: {
        attendee: {
          include: {
            event: {
              include: {
                hall: true,
          },         
           },
     },      },
},
    });

    if (!pass) {
      throw new NotFoundException(
        'Pass not found',
      );
    }

    const attendee = pass.attendee;
    const event = attendee.event;
    const hall = event.hall;

    if (!hall) {
      throw new NotFoundException(
        'No hall assigned to this event',
      );
    }

    // Recreate the EXACT information
    // that belongs inside the QR code.
    const qrData = {
      qrToken: pass.qrToken,

      attendee: {
        id: attendee.id,
        name: attendee.name,
        email: attendee.email,
        passType: attendee.passType,
      },

      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        startsAt: event.startsAt,
        endsAt: event.endsAt,

        hall: {
      id: hall.id,
      name: hall.name,
      address: hall.address,
       capacity: hall.capacity,
        },
      },
    };

    // Generate the QR
    const qrDataUrl = await QRCode.toDataURL(
      JSON.stringify(qrData),
      {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 1000,
      },
    );

    // Convert QR data URL into image buffer
    const qrImage = Buffer.from(
      qrDataUrl.replace(
        /^data:image\/png;base64,/,
        '',
      ),
      'base64',
    );

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => {
      chunks.push(chunk);
    });

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      doc.on('error', reject);

      // Center the QR code on the page
      const qrSize = 450;

      const x =
        (doc.page.width - qrSize) / 2;

      const y =
        (doc.page.height - qrSize) / 2;

      doc.image(qrImage, x, y, {
        width: qrSize,
        height: qrSize,
      });

      doc.end();
    });
  }
}