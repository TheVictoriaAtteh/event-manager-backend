import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { PassesService } from './passes.services';
import { VerifyPassDto } from './dto/verify-passes.dto';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';

@Controller('passes')
export class PassesController {
  constructor(private readonly passesService: PassesService) {}

  @Post()
  async createPass(
    @Body('attendeeId') attendeeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.passesService.createPass(attendeeId, user.id);
  }

  @Post('verify')
  async verifyPass(
    @Body() dto: VerifyPassDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.passesService.verifyPass(dto.qrToken, user.id);
  }

  @Get(':id/pdf')
  async downloadPassPdf(
    @Param('id') id: string,
    @Res() res: any,
    @CurrentUser() user: RequestUser,
  ) {
    const pdf = await this.passesService.downloadPassPdf(id, user.id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="event-pass-${id}.pdf"`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}