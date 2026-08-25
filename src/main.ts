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

  // Strict request validation: strip unknown properties, reject requests
  // with non-whitelisted properties, and transform payloads to DTO types.
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

  // Allow the configured frontend origin(s) — comma-separated FRONTEND_URL.
  const corsOrigins = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.enableShutdownHooks();

  setupSwagger(app);

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`Event Manager API listening on port ${port}`, 'Bootstrap');
  Logger.log(`Swagger documentation available at /api/docs`, 'Bootstrap');
}

void bootstrap();
