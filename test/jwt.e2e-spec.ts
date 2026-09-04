/**
 * JWT authentication e2e tests — Supabase-token architecture.
 *
 * JwtStrategy.validate() does a real DB lookup; UsersService is mocked so
 * there is no database dependency in these tests.
 */

const TEST_JWT_SECRET = 'supabase-e2e-test-secret';
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET;

import { Controller, Get, type INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { UsersService } from '../src/users/users.service';

const MOCK_LOCAL_USER = {
  id: 'local-db-user-1',
  supabaseUserId: 'supa-user-1',
  email: 'jane@example.com',
  name: 'Jane Doe',
  role: 'ATTENDEE',
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUsersService = {
  findBySupabaseUserId: jest
    .fn()
    .mockImplementation((supabaseUserId: string) =>
      supabaseUserId === MOCK_LOCAL_USER.supabaseUserId
        ? Promise.resolve(MOCK_LOCAL_USER)
        : Promise.resolve(null),
    ),
};

@Controller('protected')
class ProtectedController {
  @Get()
  hello() { return { ok: true }; }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: TEST_JWT_SECRET, signOptions: { expiresIn: '1h' } }),
  ],
  controllers: [ProtectedController],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: UsersService, useValue: mockUsersService },
  ],
})
class JwtTestModule {}

describe('JWT authentication (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [JwtTestModule] }).compile();
    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  afterAll(async () => { await app.close(); });

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

  it('rejects an expired Supabase token (401)', async () => {
    const expired = jwtService.sign({ sub: MOCK_LOCAL_USER.supabaseUserId }, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer ' + expired);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token whose sub is not in the local DB (401 USER_NOT_FOUND)', async () => {
    const token = jwtService.sign({ sub: 'unknown-supabase-user' });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('accepts a valid Supabase token whose sub maps to a local user (200)', async () => {
    const token = jwtService.sign({ sub: MOCK_LOCAL_USER.supabaseUserId });
    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer ' + token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});