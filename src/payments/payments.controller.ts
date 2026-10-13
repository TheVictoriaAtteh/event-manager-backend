import {
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

interface PaystackWebhookPayload {
  event?: string;
  data?: { reference?: string };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('webhook')
  @Public()
  @SkipThrottle()
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (
      !this.paymentsService.verifyWebhookSignature(request.rawBody, signature)
    ) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }
    const payload = request.body as PaystackWebhookPayload;
    return this.paymentsService.handleWebhook(
      payload.event,
      payload.data?.reference,
    );
  }

  @Get(':reference')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getStatus(@Param('reference') reference: string) {
    return this.paymentsService.getPublicStatus(reference);
  }
}
