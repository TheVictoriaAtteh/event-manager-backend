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
    quantity: 1,
    amountMinor: 250000,
    currency: 'NGN',
    reference: 'evt_reference',
    expiresAt: new Date(Date.now() + 30 * 60_000),
  };

  let service: PaymentsService;
  let transaction: {
    $executeRaw: jest.Mock;
    paymentOrder: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    ticketType: { updateMany: jest.Mock };
    paymentOrderAttendee: { findMany: jest.Mock };
    attendee: { create: jest.Mock };
    pass: { create: jest.Mock };
  };
  let prisma: {
    event: { findUnique: jest.Mock };
    attendee: { findUnique: jest.Mock; findFirst: jest.Mock };
    paymentOrder: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    ticketType: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let fetchMock: jest.SpyInstance;
  let passes: { emailPaidOrderPass: jest.Mock };

  beforeEach(() => {
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      paymentOrder: {
        create: jest.fn(({ data }) =>
          Promise.resolve({
            ...order,
            ...data,
            attendees: data.attendees.create,
          }),
        ),
        findUnique: jest.fn().mockResolvedValue({ ...order, status: 'PENDING' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      ticketType: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      paymentOrderAttendee: { findMany: jest.fn().mockResolvedValue([]) },
      attendee: { create: jest.fn(({ data }) => Promise.resolve({ id: data.email })) },
      pass: { create: jest.fn().mockResolvedValue({ id: 'pass-id' }) },
    };
    prisma = {
      event: { findUnique: jest.fn().mockResolvedValue({ id: 'event-id' }) },
      attendee: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      paymentOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({ ...order, status: 'PENDING' }),
        create: jest.fn(),
        update: jest.fn(({ data }) => Promise.resolve({ ...order, ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    passes = { emailPaidOrderPass: jest.fn() };

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
      ticketTypeId: order.ticketTypeId,
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
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
    const initializationBody = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as { callback_url: string };
    expect(initializationBody.callback_url).toBe(
      'https://tickets.example.com/payment/return',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns the existing checkout when the same attendee retries the request', async () => {
    const existing = {
      ...order,
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      authorizationUrl: 'https://checkout.paystack.com/already-created',
    };
    prisma.paymentOrder.findFirst.mockResolvedValue(existing);

    const result = await service.createCheckout('public-token', {
      ticketTypeId: order.ticketTypeId,
      attendees: [{ name: order.attendeeName, email: 'JANE@example.com' }],
    });

    expect(result).toMatchObject({
      orderId: order.id,
      reference: order.reference,
      authorizationUrl: existing.authorizationUrl,
      reused: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns one checkout when ten duplicate requests arrive together', async () => {
    const existing = {
      ...order,
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      authorizationUrl: 'https://checkout.paystack.com/already-created',
    };
    prisma.paymentOrder.findFirst.mockResolvedValue(existing);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.createCheckout('public-token', {
          ticketTypeId: order.ticketTypeId,
          attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
        }),
      ),
    );

    expect(new Set(results.map((result) => result.reference))).toEqual(
      new Set([order.reference]),
    );
    expect(results.every((result) => result.reused)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('reuses a multi-ticket checkout regardless of recipient query order', async () => {
    const existing = {
      ...order,
      quantity: 2,
      attendees: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Doe', email: 'jane@example.com' },
      ],
      authorizationUrl: 'https://checkout.paystack.com/already-created',
    };
    prisma.paymentOrder.findFirst.mockResolvedValue(existing);

    const result = await service.createCheckout('public-token', {
      ticketTypeId: order.ticketTypeId,
      attendees: [
        { name: 'Jane Doe', email: 'jane@example.com' },
        { name: 'John Doe', email: 'john@example.com' },
      ],
    });

    expect(result.reused).toBe(true);
    expect(result.authorizationUrl).toBe(existing.authorizationUrl);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recovers checkout initialization using the original payment reference', async () => {
    const pendingWithoutUrl = {
      ...order,
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      authorizationUrl: null,
      initializationClaimedAt: null,
    };
    prisma.paymentOrder.findFirst.mockResolvedValue(pendingWithoutUrl);

    const result = await service.createCheckout('public-token', {
      ticketTypeId: order.ticketTypeId,
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
    });

    expect(result).toMatchObject({
      orderId: order.id,
      reference: order.reference,
      authorizationUrl: 'https://checkout.paystack.com/example',
      reused: true,
    });
    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: order.id, authorizationUrl: null }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        body: expect.stringContaining(order.reference),
      }),
    );
  });

  it('rejects reuse when the active checkout has different ticket details', async () => {
    prisma.paymentOrder.findFirst.mockResolvedValue({
      ...order,
      ticketTypeId: 'another-ticket',
      attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      authorizationUrl: 'https://checkout.paystack.com/already-created',
    });

    await expect(
      service.createCheckout('public-token', {
        ticketTypeId: order.ticketTypeId,
        attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      }),
    ).rejects.toThrow('different ticket details');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects checkout when a limited ticket has sold out', async () => {
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      paymentOrder: { create: jest.fn(), findUnique: jest.fn() },
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction));

    await expect(
      service.createCheckout('public-token', {
        ticketTypeId: order.ticketTypeId,
        attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      }),
    ).rejects.toThrow('sold out');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(transaction.paymentOrder.create).not.toHaveBeenCalled();
  });

  it('reserves and charges the requested quantity and saves each recipient', async () => {
    const result = await service.createCheckout('public-token', {
      ticketTypeId: order.ticketTypeId,
      attendees: [
        { name: 'Jane Doe', email: 'jane@example.com' },
        { name: 'John Doe', email: 'john@example.com' },
      ],
    });

    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/example');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        body: expect.stringContaining('"amount":500000'),
      }),
    );
    expect(transaction.$executeRaw.mock.calls[0]).toContain(2);
    expect(transaction.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantity: 2,
          amountMinor: 500000,
          attendees: {
            create: [
              { name: 'Jane Doe', email: 'jane@example.com' },
              { name: 'John Doe', email: 'john@example.com' },
            ],
          },
        }),
      }),
    );
  });

  it('creates a pass for each attendee and increments sold inventory by quantity', async () => {
    transaction.paymentOrder.findUnique.mockResolvedValue({
      ...order,
      quantity: 2,
      status: 'PENDING',
    });
    transaction.paymentOrderAttendee.findMany.mockResolvedValue([
      { id: 'recipient-1', name: 'Jane Doe', email: 'jane@example.com' },
      { id: 'recipient-2', name: 'John Doe', email: 'john@example.com' },
    ]);

    const markOrderPaid = (
      service as unknown as {
        markOrderPaid: (orderId: string) => Promise<string>;
      }
    ).markOrderPaid.bind(service);
    await expect(markOrderPaid(order.id)).resolves.toBe('PAID');

    expect(transaction.ticketType.updateMany).toHaveBeenCalledWith({
      where: { id: order.ticketTypeId, reservedCount: { gte: 2 } },
      data: { reservedCount: { decrement: 2 }, soldCount: { increment: 2 } },
    });
    expect(transaction.attendee.create).toHaveBeenCalledTimes(2);
    expect(transaction.pass.create).toHaveBeenCalledTimes(2);
    expect(transaction.pass.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          paymentOrderAttendeeId: 'recipient-2',
        }),
      }),
    );
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

  it.each([0, -1, Number.POSITIVE_INFINITY])(
    'rejects invalid stored ticket prices before calling Paystack (%s)',
    async (priceMinor) => {
      prisma.ticketType.findFirst.mockResolvedValue({
        id: 'ticket-id',
        priceMinor,
        currency: 'NGN',
        saleStartsAt: null,
        saleEndsAt: null,
      });

      await expect(
        service.createCheckout('public-token', {
          ticketTypeId: order.ticketTypeId,
          attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
        }),
      ).rejects.toThrow('Ticket order total is invalid');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(transaction.paymentOrder.create).not.toHaveBeenCalled();
    },
  );

  it('keeps a timed-out checkout pending so its provider reference can be verified', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('provider request timed out'));

    await expect(
      service.createCheckout('public-token', {
        ticketTypeId: order.ticketTypeId,
        attendees: [{ name: order.attendeeName, email: order.attendeeEmail }],
      }),
    ).rejects.toThrow('Paystack is temporarily unavailable');

    expect(transaction.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: expect.stringMatching(/^evt_[a-f0-9]{32}$/),
        }),
      }),
    );
    expect(transaction.paymentOrder.updateMany).not.toHaveBeenCalled();

    prisma.paymentOrder.findUnique.mockResolvedValue({
      ...order,
      status: 'PENDING',
    });
    transaction.paymentOrderAttendee.findMany.mockResolvedValue([
      {
        id: 'order-attendee-id',
        name: order.attendeeName,
        email: order.attendeeEmail,
      },
    ]);
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: true,
            message: 'Verification successful',
            data: {
              id: 123,
              reference: order.reference,
              status: 'success',
              amount: order.amountMinor,
              currency: order.currency,
              metadata: { orderId: order.id },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const refreshOrder = (
      service as unknown as {
        refreshOrder: (reference: string) => Promise<string>;
      }
    ).refreshOrder.bind(service);

    await expect(refreshOrder(order.reference)).resolves.toBe('PAID');
  });

  it('makes repeated success webhooks create only one paid order and one set of passes', async () => {
    let status = 'PENDING';
    const storedOrder = { ...order, status: 'PENDING' };
    prisma.paymentOrder.findUnique.mockImplementation(() =>
      Promise.resolve({ ...storedOrder, status }),
    );
    transaction.paymentOrder.findUnique.mockImplementation(() =>
      Promise.resolve({ ...storedOrder, status }),
    );
    transaction.paymentOrder.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { status: string };
        data: { status: string };
      }) => {
        if (status !== where.status) {
          return Promise.resolve({ count: 0 });
        }
        status = data.status;
        return Promise.resolve({ count: 1 });
      },
    );
    transaction.paymentOrderAttendee.findMany.mockResolvedValue([
      {
        id: 'order-attendee-id',
        name: order.attendeeName,
        email: order.attendeeEmail,
      },
    ]);
    fetchMock.mockImplementation(
      async () =>
        new Response(
        JSON.stringify({
          status: true,
          message: 'Verification successful',
          data: {
            id: 123,
            reference: order.reference,
            status: 'success',
            amount: order.amountMinor,
            currency: order.currency,
            metadata: { orderId: order.id },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.handleWebhook('charge.success', order.reference),
      ),
    );

    expect(status).toBe('PAID');
    expect(transaction.attendee.create).toHaveBeenCalledTimes(1);
    expect(transaction.pass.create).toHaveBeenCalledTimes(1);
    expect(passes.emailPaidOrderPass).toHaveBeenCalled();
  });

  it('refunds a delayed success for an order already marked failed', async () => {
    prisma.paymentOrder.findUnique.mockResolvedValue({
      ...order,
      status: 'FAILED',
    });
    fetchMock.mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/refund')
              ? { status: true, message: 'Refund queued', data: { id: 456 } }
              : {
                  status: true,
                  message: 'Verification successful',
                  data: {
                    id: 123,
                    reference: order.reference,
                    status: 'success',
                    amount: order.amountMinor,
                    currency: order.currency,
                    metadata: { orderId: order.id },
                  },
                },
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await expect(
      service.handleWebhook('charge.success', order.reference),
    ).resolves.toEqual({ received: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/refund');
    expect(transaction.pass.create).not.toHaveBeenCalled();
  });

  it('claims a late-payment refund once when duplicate webhooks arrive together', async () => {
    let status = 'FAILED';
    const storedOrder = { ...order, status: 'FAILED' };
    prisma.paymentOrder.findUnique.mockImplementation(() =>
      Promise.resolve({ ...storedOrder, status }),
    );
    transaction.paymentOrder.findUnique.mockImplementation(() =>
      Promise.resolve({ ...storedOrder, status }),
    );
    prisma.paymentOrder.updateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { status: string | { in: string[] } };
        data: { status: string };
      }) => {
        const matches =
          typeof where.status === 'string'
            ? status === where.status
            : where.status.in.includes(status);
        if (!matches) {
          return Promise.resolve({ count: 0 });
        }
        status = data.status;
        return Promise.resolve({ count: 1 });
      },
    );
    fetchMock.mockImplementation(
      async (input) =>
        new Response(
          JSON.stringify(
            String(input).endsWith('/refund')
              ? { status: true, message: 'Refund queued', data: { id: 456 } }
              : {
                  status: true,
                  message: 'Verification successful',
                  data: {
                    id: 123,
                    reference: order.reference,
                    status: 'success',
                    amount: order.amountMinor,
                    currency: order.currency,
                    metadata: { orderId: order.id },
                  },
                },
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );

    await Promise.all(
      Array.from({ length: 10 }, () =>
        service.handleWebhook('charge.success', order.reference),
      ),
    );

    expect(status).toBe('REFUNDED');
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/refund')),
    ).toHaveLength(1);
  });

  it('propagates a mid-transaction database failure instead of returning paid', async () => {
    transaction.ticketType.updateMany.mockRejectedValue(
      new Error('database unavailable'),
    );
    const markOrderPaid = (
      service as unknown as {
        markOrderPaid: (orderId: string) => Promise<string>;
      }
    ).markOrderPaid.bind(service);

    await expect(markOrderPaid(order.id)).rejects.toThrow('database unavailable');
    expect(transaction.paymentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: order.id, status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
    expect(transaction.pass.create).not.toHaveBeenCalled();
  });
});
