
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';

import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

@Controller('protected')
class ProtectedController {
  @Get()
  hello() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: 'e2e-test-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [ProtectedController],
  providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
class JwtTestModule {}

describe('JWT authentication (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests with a missing token (401)', async () => {
    const res = await request(app.getHttpServer()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid token (401)', async () => {
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an expired token (401 TOKEN_EXPIRED)', async () => {
    const expired = jwtService.sign({ sub: 'user-1', role: 'ATTENDEE' }, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('accepts a valid token (200)', async () => {
    const token = jwtService.sign({
      sub: 'user-1',
      supabaseUserId: 'supa-1',
      email: 'jane@example.com',
      role: 'ATTENDEE',
      name: 'Jane Doe',
    });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
