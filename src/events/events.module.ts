import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PassesModule } from '../passes/passes.module';

@Module({
  imports: [PrismaModule, AuthModule, PassesModule],
  controllers: [EventsController],
  providers: [EventsService]
})
export class EventsModule {}
