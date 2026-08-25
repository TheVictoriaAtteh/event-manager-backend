import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Configures Swagger/OpenAPI documentation. Shared by `main.ts` and the
 * e2e tests so both expose the exact same documentation.
 */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Event Manager API')
      .setDescription(
        'REST API for the Event Manager application. Authentication is backed ' +
          'by Supabase Auth (credentials & email verification); protected ' +
          'endpoints require a Bearer JWT issued by POST /auth/login.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          in: 'header',
        },
        'JWT',
      )
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}
