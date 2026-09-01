
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/event_manager?schema=public';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { setupSwagger } from '../src/swagger';

describe('Event Manager API (e2e bootstrap)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves Swagger UI at /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs');
    expect([200, 301]).toContain(res.status);
  });

  it('documents the API as "Event Manager API"', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe('Event Manager API');
    // Bearer auth must be documented for protected endpoints.
    expect(res.body.components.securitySchemes).toHaveProperty('JWT');
  });

  it('protects /auth/me without a token (global guard)', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('protects /users/me without a token (global guard)', async () => {
    const res = await request(app.getHttpServer()).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid registration payload (validation pipe)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Jane', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('rejects unknown properties in registration (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'S3cure!password',
        isAdmin: true,
      });
    expect(res.status).toBe(400);
  });
});
