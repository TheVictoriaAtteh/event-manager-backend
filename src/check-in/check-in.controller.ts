import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { CheckInService } from './check-in.service';

@ApiTags('check-in')
@ApiBearerAuth()
@Controller()
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post('check-in/:passId')
  @ApiOperation({ summary: 'Scan an attendee QR pass to record check-in' })
  @ApiResponse({ status: 201, description: 'Check-in recorded successfully' })
  @ApiResponse({ status: 400, description: 'Pass is revoked or invalid' })
  @ApiResponse({ status: 404, description: 'Pass not found' })
  @ApiResponse({ status: 409, description: 'Attendee has already checked in' })
  scanPass(
    @Param('passId') passId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.checkInService.scanPass(passId, user.id);
  }

  @Get('events/:eventId/check-ins')
  @ApiOperation({ summary: 'Get all check-in log records for an event' })
  @ApiResponse({ status: 200, description: 'List of check-ins for the event' })
  @ApiResponse({ status: 403, description: 'Unauthorized access to event log' })
  getEventCheckIns(
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.checkInService.getEventCheckIns(eventId, user.id);
  }
}

