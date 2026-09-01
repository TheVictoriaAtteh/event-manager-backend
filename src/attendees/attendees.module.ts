import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttendeesController],
  providers: [AttendeesService],
})
export class AttendeesModule {}