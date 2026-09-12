import {Body,Controller,Get,Param,Post,Res} from '@nestjs/common';
import { Response } from 'express';
import { PassesService } from './passes.service';
import { PassPdfService } from './pass-pdf.services';
import { VerifyPassDto } from './dto/verify-passes.dto';

@Controller('passes')
export class PassesController {
  constructor(private readonly passesService: PassesService,private readonly passPdfService: PassPdfService) {}

  @Post()
  async createPass(
    @Body('attendeeId') attendeeId: string,
  ) {
    return this.passesService.createPass(
      attendeeId,
    );
  }

@Post('verify')
async verifyPass
(@Body() dto: VerifyPassDto) {
  return this.passesService.verifyPass(dto.qrToken);
}

  @Get(':id/pdf')
  async downloadPassPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf =
      await this.passPdfService.generatePassPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="event-pass-${id}.pdf"`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }
}