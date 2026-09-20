import { Controller, Body, Post, Get, Patch, Param, Delete } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignHallDto } from './dto/assign-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateAttendeeDto } from '../attendees/dto/create-attendee.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@Body() createEventDto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.create(createEventDto, user.id);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }


@Get('register/:token')
@Public()
getPublicEvent(@Param('token') token: string) {
  return this.eventsService.getPublicEvent(token);
}


@Post('register/:token')
@Public()
registerAttendee(
  @Param('token') token: string,
  @Body() dto: CreateAttendeeDto,
) {
  return this.eventsService.createAttendee(token, dto);
}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.update(id, updateEventDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.eventsService.remove(id, user.id);
  }

  @Patch(':id/hall')
  assignHall(@Param('id') id: string, @Body() assignHallDto: AssignHallDto,
  ) {
    return this.eventsService.assignHall(
      id,
      assignHallDto.hallId,
    );
  }
}
