import { Controller,Body, Post, Get, Patch, Param, Delete} from '@nestjs/common';
import { PartialType} from '@nestjs/mapped-types';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignHallDto } from './dto/assign-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';


export class createEventDto extends PartialType(CreateEventDto){}

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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() UpdateEventDtodto: UpdateEventDto) {
    return this.eventsService.update(id, UpdateEventDtodto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
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