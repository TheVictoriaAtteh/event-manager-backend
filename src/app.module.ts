import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './database/prisma.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { HallsModule } from './halls/halls.module';

/**
 * Root module.
 *
 * Controller → Service → PrismaService → PostgreSQL
 * Authentication flows through Supabase Auth; feature modules will be
 * registered here as they are implemented.
 *
 * JwtAuthGuard is applied globally: every route requires a valid JWT unless
 * it is decorated with @Public().
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    EventsModule,
    HallsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
