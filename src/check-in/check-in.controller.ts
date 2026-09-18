import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';

import { CheckInService } from './check-in.service';

@Controller('check-in')
export class CheckInController {
  constructor(
    private readonly checkInService: CheckInService,
  ) {}

  @Post()
  async checkIn(
    @Body('qrToken') qrToken: string,
  ) {
    return this.checkInService.checkIn(
      qrToken,
    );
  }
}