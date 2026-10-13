import { Controller, Body, Post, Get, Patch, Param, Delete } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignHallDto } from './dto/assign-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { PaymentsService } from '../payments/payments.service';
import { CreateTicketOrderDto } from '../payments/dto/create-ticket-order.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  create(@Body() createEventDto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.eventsService.create(createEventDto, user.id);
  }

  @Get()
  findAll( @CurrentUser() user: RequestUser) {
    return this.eventsService.findAll(user.id);
  }


@Get('register/:token')
@Public()
getPublicEvent(@Param('token') token: string) {
  return this.eventsService.getPublicEvent(token);
}


@Post('register/:token')
@Public()
@Throttle({ default: { limit: 5, ttl: 60_000 } })
createTicketOrder(
  @Param('token') token: string,
  @Body() dto: CreateTicketOrderDto,
) {
  return this.paymentsService.createCheckout(token, dto);
}

  @Get(':id/ticket-types')
  listTicketTypes(
    @Param('id') eventId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.listTicketTypes(eventId, user.id);
  }

  @Post(':id/ticket-types')
  createTicketType(
    @Param('id') eventId: string,
    @Body() dto: CreateTicketTypeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.createTicketType(eventId, dto, user.id);
  }

  @Patch(':id/ticket-types/:ticketTypeId')
  updateTicketType(
    @Param('id') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() dto: UpdateTicketTypeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.updateTicketType(
      eventId,
      ticketTypeId,
      dto,
      user.id,
    );
  }

  @Delete(':id/ticket-types/:ticketTypeId')
  deactivateTicketType(
    @Param('id') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.deactivateTicketType(
      eventId,
      ticketTypeId,
      user.id,
    );
}

  @Get(':id')
  findOne(@Param('id') id: string,  @CurrentUser() user: RequestUser) {
    return this.eventsService.findOne(id,user.id);
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
  assignHall(@Param('id') id: string, @Body() assignHallDto: AssignHallDto,  @CurrentUser() user: RequestUser,
  ) {
    return this.eventsService.assignHall(
      id,
      assignHallDto.hallId,user.id,
    );
  }
}
