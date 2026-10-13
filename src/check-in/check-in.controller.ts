import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';

import { CheckInService } from './check-in.service';

@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly checkInService: CheckInService,
  ) {}

  @Post()
  async checkIn(
    @Body('qrToken') qrToken: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.checkInService.checkIn(
      qrToken,
      user.id,
    );
  }
}