import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { EmailModule } from 'src/email/email.module';
import { PassPdfService } from 'src/passes/pass-pdf.services';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AttendeesController],
  providers: [AttendeesService,PassPdfService],
})
export class AttendeesModule {}