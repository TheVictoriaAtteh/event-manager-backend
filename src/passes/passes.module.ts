import { Module } from '@nestjs/common';

import { PassesController } from './passes.controller';
import { PassesService } from './passes.services';
import { PassPdfService } from './pass-pdf.services';
import { PrismaService } from '../database/prisma.service';
import { EmailModule } from '../email/email.module';
import { CheckInModule } from '../check-in/check-in.module';

@Module({
  imports: [
    EmailModule,
    CheckInModule,
  ],
  controllers: [PassesController],
  providers: [
    PassesService,
    PassPdfService,
    PrismaService,
  ],
  exports: [
    PassesService,
    PassPdfService,
  ],
})
export class PassesModule {}