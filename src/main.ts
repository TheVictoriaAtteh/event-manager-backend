import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // CORS: always allow the deployed Cloudflare Pages frontend and local
  // development, plus any extra origins supplied via FRONTEND_URL (comma-separated).
  const configuredCorsOrigins = (config.get<string>('FRONTEND_URL') ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const corsOrigins = [
    ...new Set([
      'https://eventfrontend.pages.dev',
      'http://localhost:3000',
      ...configuredCorsOrigins,
    ]),
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.enableShutdownHooks();
  setupSwagger(app);

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Event Manager API listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger documentation available at /api/docs`, 'Bootstrap');
}

void bootstrap();