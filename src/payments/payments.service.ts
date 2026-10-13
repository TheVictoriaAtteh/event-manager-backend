import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { PaymentOrder } from '@prisma/client';
import type { PaymentStatus } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { PassesService } from '../passes/passes.services';
import { CreateTicketOrderDto } from './dto/create-ticket-order.dto';

interface PaystackTransaction {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: string | Record<string, unknown> | null;
}

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly passesService: PassesService,
  ) {}

  onModuleInit(): void {
    this.expiryTimer = setInterval(() => {
      void this.processBackgroundWork().catch((error: unknown) => {
        this.logger.error(
          'Unable to process ticket payment background work',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 300_000);
    this.expiryTimer.unref();
    void this.processBackgroundWork().catch((error: unknown) => {
      this.logger.error(
        'Unable to process ticket payment background work',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  onModuleDestroy(): void {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
    }
  }

  async createCheckout(token: string, dto: CreateTicketOrderDto) {
    const attendees = dto.attendees?.map((attendee) => ({
      name: attendee.name.trim(),
      email: attendee.email.trim().toLowerCase(),
    })) ?? (
      dto.name?.trim() && dto.email?.trim()
        ? [{ name: dto.name.trim(), email: dto.email.trim().toLowerCase() }]
        : []
    );
    if (attendees.length === 0 || attendees.length > 10) {
      throw new BadRequestException(
        'Provide attendee name and email for 1 to 10 tickets',
      );
    }
    if (
      attendees.some((attendee) => !attendee.name || !attendee.email) ||
      new Set(attendees.map((attendee) => attendee.email)).size !== attendees.length
    ) {
      throw new BadRequestException(
        'Each ticket must have a name and a unique attendee email',
      );
    }
    const primaryAttendee = attendees[0];
    if (!primaryAttendee) {
      throw new BadRequestException('At least one ticket attendee is required');
    }
    const event = await this.prisma.event.findUnique({
      where: { publicRegistrationToken: token },
      select: { id: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const callbackFrontendUrl = frontendUrl
      ?.split(',')
      .map((origin) => origin.trim())
      .find(Boolean);
    const callbackUrl =
      this.config.get<string>('PAYSTACK_CALLBACK_URL') ??
      (callbackFrontendUrl
        ? `${callbackFrontendUrl.replace(/\/+$/, '')}/payment/return`
        : undefined);
    if (!callbackUrl) {
      throw new ServiceUnavailableException(
        'Set PAYSTACK_CALLBACK_URL or FRONTEND_URL before accepting ticket payments',
      );
    }

    const existingAttendee = await this.prisma.attendee.findFirst({
      where: {
        eventId: event.id,
        OR: attendees.map(({ email }) => ({
          email: { equals: email, mode: 'insensitive' as const },
        })),
      },
      select: { id: true },
    });
    if (existingAttendee) {
      throw new ConflictException(
        'This email is already registered for this event',
      );
    }

    const pendingOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        eventId: event.id,
        attendeeEmail: primaryAttendee.email,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: { attendees: true },
    });
    if (pendingOrder) {
      if (pendingOrder.expiresAt <= new Date()) {
        const status = await this.refreshOrder(pendingOrder.reference);
        if (status === 'PAID') {
          throw new ConflictException(
            'This email already has a paid ticket for this event',
          );
        }
        if (status === 'PENDING') {
          throw new ConflictException(
            'Your existing payment is still processing. Check its status before starting another checkout.',
          );
        }
      } else {
        if (
          pendingOrder.ticketTypeId !== dto.ticketTypeId ||
          !this.attendeesMatch(pendingOrder.attendees, attendees)
        ) {
          throw new ConflictException(
            'A checkout for this email already exists with different ticket details. Complete it or wait for it to expire before changing the selection.',
          );
        }
        if (pendingOrder.authorizationUrl) {
          return this.checkoutResponse(pendingOrder, true);
        }
        const claimedAt = new Date();
        const claim = await this.prisma.paymentOrder.updateMany({
          where: {
            id: pendingOrder.id,
            status: 'PENDING',
            authorizationUrl: null,
            OR: [
              { initializationClaimedAt: null },
              {
                initializationClaimedAt: {
                  lt: new Date(claimedAt.getTime() - 5 * 60_000),
                },
              },
            ],
          },
          data: { initializationClaimedAt: claimedAt },
        });
        if (claim.count !== 1) {
          throw new ConflictException(
            'Your checkout is being initialized. Retry this request shortly.',
          );
        }
        return this.initializeCheckout(pendingOrder, callbackUrl, true);
      }
    }

    const ticketType = await this.prisma.ticketType.findFirst({
      where: { id: dto.ticketTypeId, eventId: event.id, isActive: true },
    });
    const now = new Date();
    if (
      !ticketType ||
      (ticketType.saleStartsAt && ticketType.saleStartsAt > now) ||
      (ticketType.saleEndsAt && ticketType.saleEndsAt < now)
    ) {
      throw new NotFoundException('Ticket type is not available');
    }

    const reference = `evt_${randomUUID().replace(/-/g, '')}`;
    const expiresAt = new Date(now.getTime() + 30 * 60_000);
    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        const reserved = await tx.$executeRaw`
          UPDATE "ticket_types"
          SET "reservedCount" = "reservedCount" + ${attendees.length}
          WHERE "id" = ${ticketType.id}
            AND "isActive" = TRUE
            AND ("quantity" IS NULL OR "soldCount" + "reservedCount" + ${attendees.length} <= "quantity")
            AND ("saleStartsAt" IS NULL OR "saleStartsAt" <= NOW())
            AND ("saleEndsAt" IS NULL OR "saleEndsAt" >= NOW())
        `;
        if (reserved !== 1) {
          throw new ConflictException(
            'This ticket type is sold out or no longer on sale',
          );
        }

        const amountMinor = ticketType.priceMinor * attendees.length;
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
          throw new BadRequestException('Ticket order total is invalid');
        }

        return tx.paymentOrder.create({
          data: {
            eventId: event.id,
            ticketTypeId: ticketType.id,
            attendeeName: primaryAttendee.name,
            attendeeEmail: primaryAttendee.email,
            quantity: attendees.length,
            attendees: { create: attendees },
            amountMinor,
            currency: ticketType.currency,
            reference,
            activeCheckoutKey: `${event.id}:${primaryAttendee.email}`,
            initializationClaimedAt: now,
            expiresAt,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentOrder = await this.prisma.paymentOrder.findFirst({
          where: {
            eventId: event.id,
            attendeeEmail: primaryAttendee.email,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
          include: { attendees: true },
        });
        const matchesRequestedAttendees =
          concurrentOrder !== null &&
          concurrentOrder !== undefined &&
          this.attendeesMatch(concurrentOrder.attendees, attendees);
        if (
          concurrentOrder?.authorizationUrl &&
          concurrentOrder.ticketTypeId === dto.ticketTypeId &&
          matchesRequestedAttendees
        ) {
          return this.checkoutResponse(concurrentOrder, true);
        }
        throw new ConflictException(
          'A checkout for this email is already being created. Retry this request shortly.',
        );
      }
      throw error;
    }

    return this.initializeCheckout(order, callbackUrl, false);
  }

  private async initializeCheckout(
    order: PaymentOrder,
    callbackUrl: string,
    reused: boolean,
  ) {
    let initialized: PaystackResponse<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>;
    try {
      initialized = await this.paystackRequest<PaystackResponse<{
        authorization_url: string;
        access_code: string;
        reference: string;
      }>>('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: order.attendeeEmail,
          amount: order.amountMinor,
          currency: order.currency,
          reference: order.reference,
          callback_url: callbackUrl,
          metadata: {
            orderId: order.id,
            eventId: order.eventId,
            ticketTypeId: order.ticketTypeId,
            quantity: order.quantity,
          },
        }),
      });
    } catch (error) {
      if (error instanceof BadGatewayException) {
        await this.releaseReservation(order.id, 'FAILED');
      }
      throw error;
    }

    if (!initialized.status || initialized.data.reference !== order.reference) {
      await this.releaseReservation(order.id, 'FAILED');
      throw new BadGatewayException(
        initialized.message || 'Paystack did not initialize this checkout',
      );
    }

    const updatedOrder = await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        authorizationUrl: initialized.data.authorization_url,
        initializationClaimedAt: null,
      },
    });
    return this.checkoutResponse(updatedOrder, reused);
  }

  private checkoutResponse(
    order: {
      id: string;
      reference: string;
      authorizationUrl: string | null;
      expiresAt: Date;
    },
    reused: boolean,
  ) {
    return {
      orderId: order.id,
      reference: order.reference,
      authorizationUrl: order.authorizationUrl,
      expiresAt: order.expiresAt,
      reused,
    };
  }

  private attendeesMatch(
    existing: Array<{ name: string; email: string }>,
    requested: Array<{ name: string; email: string }>,
  ): boolean {
    if (existing.length !== requested.length) {
      return false;
    }
    const existingByEmail = new Map(
      existing.map((attendee) => [attendee.email.toLowerCase(), attendee]),
    );
    return requested.every((attendee) => {
      const stored = existingByEmail.get(attendee.email);
      return stored?.name === attendee.name;
    });
  }

  async getPublicStatus(reference: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference },
      include: {
        event: { select: { title: true } },
        ticketType: { select: { name: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Ticket checkout not found');
    }

    const status = await this.refreshOrder(reference);
    return {
      reference: order.reference,
      status,
      amountMinor: order.amountMinor,
      currency: order.currency,
      eventTitle: order.event.title,
      ticketType: order.ticketType.name,
    };
  }

  verifyWebhookSignature(rawBody: Buffer | undefined, signature?: string): boolean {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret || !rawBody || !signature || !/^[a-f0-9]{128}$/i.test(signature)) {
      return false;
    }
    const expected = createHmac('sha512', secret).update(rawBody).digest();
    const received = Buffer.from(signature, 'hex');
    return received.length === expected.length && timingSafeEqual(received, expected);
  }

  async handleWebhook(event: string | undefined, reference?: string) {
    if (event !== 'charge.success' || !reference) {
      return { received: true };
    }
    await this.refreshOrder(reference);
    return { received: true };
  }

  private async refreshOrder(reference: string): Promise<PaymentStatus> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference },
    });
    if (!order) {
      throw new NotFoundException('Ticket checkout not found');
    }
    if (order.status === 'PAID') {
      await this.passesService.emailPaidOrderPass(order.id);
      return 'PAID';
    }
    if (order.status === 'REFUNDED') {
      return order.status;
    }

    let verification: PaystackResponse<PaystackTransaction>;
    try {
      verification = await this.paystackRequest<
        PaystackResponse<PaystackTransaction>
      >(`/transaction/verify/${encodeURIComponent(reference)}`);
    } catch (error) {
      if (
        order.status === 'PENDING' &&
        error instanceof NotFoundException &&
        order.expiresAt <= new Date()
      ) {
        await this.releaseReservation(order.id, 'EXPIRED');
        return 'EXPIRED';
      }
      throw error;
    }
    if (!verification.status) {
      if (
        order.status === 'PENDING' &&
        order.expiresAt <= new Date() &&
        /not found|invalid reference/i.test(verification.message)
      ) {
        await this.releaseReservation(order.id, 'EXPIRED');
        return 'EXPIRED';
      }
      throw new BadGatewayException('Paystack could not verify this transaction');
    }
    if (verification.data.reference !== reference) {
      throw new BadGatewayException('Paystack could not verify this transaction');
    }

    const transaction = verification.data;
    if (
      transaction.amount !== order.amountMinor ||
      transaction.currency !== order.currency ||
      !this.metadataMatchesOrder(transaction.metadata, order.id)
    ) {
      throw new BadRequestException(
        'Verified payment details do not match this ticket order',
      );
    }

    if (transaction.status === 'success') {
      if (order.status === 'FAILED' || order.status === 'EXPIRED') {
        return this.refundLatePayment(order.id, transaction.id);
      }
      const paid = await this.markOrderPaid(order.id);
      if (paid === 'PAID') {
        await this.passesService.emailPaidOrderPass(order.id);
      } else if (paid === 'FAILED' || paid === 'EXPIRED') {
        return this.refundLatePayment(order.id, transaction.id);
      }
      return paid;
    }

    if (transaction.status === 'failed' || transaction.status === 'abandoned') {
      if (order.status === 'PENDING') {
        await this.releaseReservation(order.id, 'FAILED');
        return 'FAILED';
      }
      return order.status;
    }

    if (order.status === 'PENDING' && order.expiresAt <= new Date()) {
      await this.releaseReservation(order.id, 'EXPIRED');
      return 'EXPIRED';
    }
    return order.status;
  }

  private async markOrderPaid(orderId: string): Promise<PaymentStatus> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new NotFoundException('Ticket checkout not found');
      }
      if (order.status !== 'PENDING') {
        return order.status;
      }

      const markedPaid = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          activeCheckoutKey: null,
        },
      });
      if (markedPaid.count !== 1) {
        const currentOrder = await tx.paymentOrder.findUnique({
          where: { id: order.id },
        });
        return currentOrder?.status ?? 'FAILED';
      }

      const reservation = await tx.ticketType.updateMany({
        where: {
          id: order.ticketTypeId,
          reservedCount: { gte: order.quantity },
        },
        data: {
          reservedCount: { decrement: order.quantity },
          soldCount: { increment: order.quantity },
        },
      });
      if (reservation.count !== 1) {
        throw new ConflictException('Ticket reservation is no longer available');
      }

      const orderAttendees = await tx.paymentOrderAttendee.findMany({
        where: { paymentOrderId: order.id },
        orderBy: { createdAt: 'asc' },
      });
      if (orderAttendees.length !== order.quantity) {
        throw new ConflictException('Ticket order attendee details are incomplete');
      }

      for (const orderAttendee of orderAttendees) {
        const attendee = await tx.attendee.create({
          data: {
            eventId: order.eventId,
            name: orderAttendee.name,
            email: orderAttendee.email,
          },
        });
        await tx.pass.create({
          data: {
            attendeeId: attendee.id,
            ticketTypeId: order.ticketTypeId,
            paymentOrderId: order.id,
            paymentOrderAttendeeId: orderAttendee.id,
            qrToken: randomUUID(),
          },
        });
      }
      return 'PAID';
    });
  }

  private async releaseReservation(
    orderId: string,
    status: 'FAILED' | 'EXPIRED',
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: orderId },
      });
      if (!order || order.status !== 'PENDING') {
        return;
      }
      const updated = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: 'PENDING' },
        data: {
          status,
          activeCheckoutKey: null,
          initializationClaimedAt: null,
        },
      });
      if (updated.count !== 1) {
        return;
      }
      const released = await tx.ticketType.updateMany({
        where: {
          id: order.ticketTypeId,
          reservedCount: { gte: order.quantity },
        },
        data: { reservedCount: { decrement: order.quantity } },
      });
      if (released.count !== 1) {
        throw new ConflictException('Ticket reservation could not be released');
      }
    });
  }

  private async refundLatePayment(
    orderId: string,
    transactionId: number,
  ): Promise<PaymentStatus> {
    const claim = await this.prisma.paymentOrder.updateMany({
      where: {
        id: orderId,
        status: { in: ['FAILED', 'EXPIRED'] },
      },
      data: { status: 'REFUNDING' },
    });
    if (claim.count !== 1) {
      const currentOrder = await this.prisma.paymentOrder.findUnique({
        where: { id: orderId },
        select: { status: true },
      });
      if (!currentOrder) {
        throw new NotFoundException('Ticket checkout not found');
      }
      return currentOrder.status;
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) {
      throw new NotFoundException('Ticket checkout not found');
    }
    const refund = await this.paystackRequest<
      PaystackResponse<{ id: number; status?: string }>
    >('/refund', {
      method: 'POST',
      body: JSON.stringify({
        transaction: transactionId,
        reason: 'Ticket checkout expired before payment confirmation',
      }),
    });
    if (!refund.status) {
      throw new BadGatewayException('Paystack could not refund the late payment');
    }
    const updated = await this.prisma.paymentOrder.updateMany({
      where: { id: orderId, status: 'REFUNDING' },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
        activeCheckoutKey: null,
      },
    });
    if (updated.count === 1) {
      return 'REFUNDED';
    }
    const currentOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    return currentOrder?.status ?? 'REFUNDING';
  }

  private async expirePendingOrders(): Promise<void> {
    const expired = await this.prisma.paymentOrder.findMany({
      where: { status: 'PENDING', expiresAt: { lte: new Date() } },
      select: { reference: true },
      take: 50,
    });
    for (const order of expired) {
      try {
        await this.refreshOrder(order.reference);
      } catch (error) {
        this.logger.warn(
          `Unable to confirm expired checkout ${order.reference}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private async processBackgroundWork(): Promise<void> {
    await this.expirePendingOrders();
    const unconfirmedRefunds = await this.prisma.paymentOrder.findMany({
      where: {
        status: 'REFUNDING',
        updatedAt: { lt: new Date(Date.now() - 5 * 60_000) },
      },
      select: { id: true },
      take: 50,
    });
    for (const order of unconfirmedRefunds) {
      this.logger.error(
        `Paystack refund confirmation is pending for payment order ${order.id}`,
      );
    }

    const undelivered = await this.prisma.paymentOrder.findMany({
      where: {
        status: 'PAID',
        emailSentAt: null,
        attendees: {
          some: {
            emailSentAt: null,
            emailDeliveryFailedAt: null,
          },
        },
      },
      select: { id: true },
      take: 50,
    });
    for (const order of undelivered) {
      try {
        await this.passesService.emailPaidOrderPass(order.id);
      } catch (error) {
        this.logger.warn(
          `Unable to send ticket email for order ${order.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  private metadataMatchesOrder(
    metadata: PaystackTransaction['metadata'],
    orderId: string,
  ): boolean {
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata) as Record<string, unknown>;
      } catch {
        return false;
      }
    }
    return (
      metadata !== null &&
      typeof metadata === 'object' &&
      metadata.orderId === orderId
    );
  }

  private async paystackRequest<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException(
        'Paystack is not configured on this server',
      );
    }

    let response: Response;
    try {
      response = await fetch(`https://api.paystack.co${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Paystack is temporarily unavailable; retry this request',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException('Paystack transaction not found');
    }

    let payload: T;
    try {
      payload = (await response.json()) as T;
    } catch {
      throw new BadGatewayException('Paystack returned an invalid response');
    }
    if (!response.ok) {
      throw new BadGatewayException('Paystack rejected the request');
    }
    return payload;
  }
}
