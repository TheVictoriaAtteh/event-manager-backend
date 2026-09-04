import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './database/prisma.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { HallsModule } from './halls/halls.module';
import { AttendeesModule } from './attendees/attendees.module';
import { CheckInModule } from './check-in/check-in.module';
import { UploadsModule } from './uploads/uploads.module';

/**
 * Root module.
 *
 * Controller → Service → PrismaService → PostgreSQL
 * Authentication flows through Supabase Auth; feature modules will be
 * registered here as they are implemented.
 *
 * JwtAuthGuard is applied globally: every route requires a valid JWT unless
 * it is decorated with @Public().
 * RolesGuard enforces @Roles() decorators on protected endpoints.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    EventsModule,
    HallsModule,
    AttendeesModule,
    CheckInModule,
    UploadsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
