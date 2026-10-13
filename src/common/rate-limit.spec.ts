import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import request from 'supertest';

@Controller('limited')
class LimitedController {
  @Get()
  @Throttle({ default: { limit: 1, ttl: 60_000 } })
  read() {
    return { ok: true };
  }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [LimitedController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class RateLimitTestModule {}

describe('API rate limiting', () => {
  it('rejects repeated requests after the route limit is reached', async () => {
    const app = await Test.createTestingModule({
      imports: [RateLimitTestModule],
    }).compile();
    const server = app.createNestApplication();
    await server.init();

    try {
      await request(server.getHttpServer()).get('/limited').expect(200);
      await request(server.getHttpServer()).get('/limited').expect(429);
    } finally {
      await server.close();
    }
  });
});
