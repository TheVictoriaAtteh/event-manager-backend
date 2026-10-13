import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PassesService } from './passes.services';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { PassPdfService } from './pass-pdf.services';
import { CheckInService } from '../check-in/check-in.service';

describe('PassesService resource authorization', () => {
  const attendee = {
    id: 'attendee-id',
    name: 'Jane Doe',
    email: 'jane@example.com',
    event: {
      id: 'event-id',
      title: 'Example event',
      organizerId: 'organizer-a',
    },
  };
  let service: PassesService;
  let prisma: {
    attendee: { findUnique: jest.Mock };
    pass: { create: jest.Mock; findFirst: jest.Mock };
  };
  let passPdf: { generatePassPdf: jest.Mock };

  beforeEach(() => {
    prisma = {
      attendee: { findUnique: jest.fn().mockResolvedValue(attendee) },
      pass: {
        create: jest.fn().mockResolvedValue({
          id: 'pass-id',
          qrToken: 'qr-token',
        }),
        findFirst: jest.fn().mockResolvedValue({ id: 'pass-id' }),
      },
    };
    passPdf = { generatePassPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    service = new PassesService(
      prisma as unknown as PrismaService,
      {} as EmailService,
      passPdf as unknown as PassPdfService,
      {} as CheckInService,
    );
  });

  it('prevents an organizer from issuing a pass for another organizer attendee', async () => {
    await expect(
      service.createPass(attendee.id, 'organizer-b'),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.pass.create).not.toHaveBeenCalled();
  });

  it('only generates a pass PDF after matching the owning event organizer', async () => {
    await expect(
      service.downloadPassPdf('pass-id', 'organizer-a'),
    ).resolves.toEqual(Buffer.from('pdf'));
    expect(prisma.pass.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'pass-id',
        attendee: { event: { organizerId: 'organizer-a' } },
      },
      select: { id: true },
    });

    prisma.pass.findFirst.mockResolvedValue(null);
    await expect(
      service.downloadPassPdf('pass-id', 'organizer-b'),
    ).rejects.toThrow(NotFoundException);
    expect(passPdf.generatePassPdf).toHaveBeenCalledTimes(1);
  });
});
