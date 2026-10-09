import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { PassesService } from '../passes/passes.services';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const order = {
    id: 'order-id',
    eventId: 'event-id',
    ticketTypeId: 'ticket-id',
    attendeeName: 'Jane Doe',
    attendeeEmail: 'jane@example.com',
    amountMinor: 250000,
    currency: 'NGN',
    reference: 'evt_reference',
    expiresAt: new Date(Date.now() + 30 * 60_000),
  };

  let service: PaymentsService;
  let prisma: {
    event: { findUnique: jest.Mock };
    attendee: { findUnique: jest.Mock; findFirst: jest.Mock };
    paymentOrder: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    ticketType: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      paymentOrder: {
        create: jest.fn(({ data }) => Promise.resolve({ ...order, ...data })),
        findUnique: jest.fn().mockResolvedValue({ ...order, status: 'PENDING' }),
      },
    };
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      attendee: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      paymentOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(({ data }) => Promise.resolve({ ...order, ...data })),
      },
      ticketType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          priceMinor: 250000,
          currency: 'NGN',
          saleStartsAt: null,
          saleEndsAt: null,
        }),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    const config = {
      get: jest.fn((key: string) =>
        ({
          PAYSTACK_SECRET_KEY: 'test-secret',
          FRONTEND_URL: 'https://tickets.example.com',
        })[key],
      ),
    };
    const passes = { emailPaidOrderPass: jest.fn() };

    service = new PaymentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
      passes as unknown as PassesService,
    );
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      async (_input, init) => {
        const request = JSON.parse(String(init?.body)) as { reference: string };
        return new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/example',
            access_code: 'access-code',
            reference: request.reference,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('initializes checkout using the stored ticket price and currency', async () => {
    const result = await service.createCheckout('public-token', {
      name: order.attendeeName,
      email: order.attendeeEmail,
      ticketTypeId: order.ticketTypeId,
    });

    expect(result).toMatchObject({
      orderId: order.id,
      reference: order.reference,
      authorizationUrl: 'https://checkout.paystack.com/example',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"amount":250000'),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects checkout when a limited ticket has sold out', async () => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      paymentOrder: { create: jest.fn(), findUnique: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await expect(
      service.createCheckout('public-token', {
        name: order.attendeeName,
        email: order.attendeeEmail,
        ticketTypeId: order.ticketTypeId,
      }),
    ).rejects.toThrow('sold out');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transaction.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('accepts only an HMAC signature for the exact webhook body', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = createHmac('sha512', 'test-secret')
      .update(body)
      .digest('hex');

    expect(service.verifyWebhookSignature(body, signature)).toBe(true);
    expect(service.verifyWebhookSignature(body, 'f'.repeat(128))).toBe(false);
    expect(service.verifyWebhookSignature(undefined, signature)).toBe(false);
  });
});
