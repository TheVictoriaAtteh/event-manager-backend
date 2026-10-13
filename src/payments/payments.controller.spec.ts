import { UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController webhook authentication', () => {
  it('rejects a fake signature without processing its payload', async () => {
    const service = {
      verifyWebhookSignature: jest.fn().mockReturnValue(false),
      handleWebhook: jest.fn(),
    };
    const controller = new PaymentsController(
      service as unknown as PaymentsService,
    );

    await expect(
      controller.webhook(
        {
          rawBody: Buffer.from('{"event":"charge.success"}'),
          body: { event: 'charge.success', data: { reference: 'forged' } },
        } as RawBodyRequest<Request>,
        'f'.repeat(128),
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(service.handleWebhook).not.toHaveBeenCalled();
  });
});
