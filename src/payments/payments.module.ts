import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { PassesModule } from '../passes/passes.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, PassesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
