import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CheckInService } from './check-in.service';

describe('CheckInService resource authorization', () => {
  it('prevents a different event organizer from checking in a pass', async () => {
    const prisma = {
      pass: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pass-id',
          revokedAt: null,
          checkIn: null,
          attendee: {
            id: 'attendee-id',
            event: { organizerId: 'organizer-a' },
          },
          ticketType: null,
        }),
      },
      checkIn: { create: jest.fn() },
    };
    const service = new CheckInService(prisma as unknown as PrismaService);

    await expect(service.checkIn('valid-qr-token', 'organizer-b')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.checkIn.create).not.toHaveBeenCalled();
  });
});
