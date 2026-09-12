import { Module } from '@nestjs/common';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { PassPdfService } from './pass-pdf.services';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [PassesController],
  providers: [PassesService, PassPdfService, PrismaService],
  exports: [PassesService, PassPdfService],
})
export class PassesModule {}
