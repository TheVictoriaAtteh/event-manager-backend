import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignHallDto } from './dto/assign-hall.dto';

@Injectable()
export class EventsService {constructor(private prisma: PrismaService) {}

 async create(dto: CreateEventDto, organizerId: string) {
   const organization = await this.prisma.organization.findFirst({
     where: { ownerId: organizerId },
     select: { id: true },
   });

   if (!organization) {
     throw new BadRequestException('User does not own an organization');
   }

const {
    date,
    title,
    description,
    startsAt,
    endsAt,
    capacity,
    location,
    logoUrl,
    brandColor,
    hallId,
  } = dto;

  // Optional hall assignment is validated before creating the event.
  if (hallId) {
    const hall = await this.prisma.hall.findUnique({
      where: { id: hallId },
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    const conflictingEvent = await this.prisma.event.findFirst({
      where: {
        hallId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (conflictingEvent) {
      throw new BadRequestException('This hall is already booked for this time.');
    }
  }

  return this.prisma.event.create({
    data: {
      date,
      description,
      title,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      capacity,
      location,
      logoUrl,
      brandColor,
      organizerId,
      organizationId: organization.id,
      hallId: hallId ?? null,
    },
    include: { organizer: true, hall: true },
  });
}


findAll() {
    return this.prisma.event.findMany({
      orderBy: { date: 'asc' },
      include: { 
        organizer: { select: { id: true, name: true, email: true } },
        hall: true,
        _count: { select: { attendees: true } }, 
      },
    });
  
  }


  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: { 
        organizer: true, 
        hall: true, 
      },
    });
    if (!event) throw new NotFoundException(`Event with id ${id} not found`);
    return event;
}


async update(id: string, updateEventDto: UpdateEventDto, organizerId: string) {
  const event = await this.findOne(id);

  if (event.organizerId !== organizerId) {
    throw new ForbiddenException('You do not have permission to update this event');
  }

  const { date, ...eventData } = updateEventDto;
    
  return this.prisma.event.update({
    where: { id },
    data: {...eventData, 
    ...(date && { date }),
  },
    include: { organizer: true, hall: true },
  });
}


async remove(id: string, organizerId: string) {
  const event = await this.findOne(id);

  if (event.organizerId !== organizerId) {
    throw new ForbiddenException('You do not have permission to delete this event');
  }

  return this.prisma.event.delete({ where: { id } });
}



async assignHall(eventId: string, hallId: string) {
 const event = await this.prisma.event.findUnique({
 where: { id: eventId },
 });
 if (!event) {
 throw new NotFoundException('Event not found');
 }
 const hall = await this.prisma.hall.findUnique({
 where: { id: hallId },
 });
 if (!hall) {
 throw new NotFoundException('Hall not found');
 }

if (hall.organizationId !== event.organizationId) {
    throw new BadRequestException(
      'Hall does not belong to this organization',
    );
  }

 return this.prisma.event.update({
 where: { id: eventId },
 data: {hallId: hall.id},
 include: {hall: true},
 });
}
}