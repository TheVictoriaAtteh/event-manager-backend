import { Body, Controller, Post } from '@nestjs/common';
import { CheckInService } from './checkin.services';
import { CheckInDto } from './dto/checkin.dto';

@Controller('check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post()
  async scan(@Body() dto: CheckInDto) {
    return this.checkInService.scan(dto.qrToken);
  }
}