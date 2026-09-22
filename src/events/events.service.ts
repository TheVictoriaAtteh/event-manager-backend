import {BadRequestException, ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SupabaseService } from '../auth/supabase.service';
import { CreateAttendeeDto } from '../attendees/dto/create-attendee.dto';
import { PassesService } from '../passes/passes.services';
@Injectable()
export class EventsService {

  constructor(private prisma: PrismaService,private  supabaseService: SupabaseService,private passesService: PassesService) {}

  async create(dto: CreateEventDto,organizerId: string,file?: any) {
   const {
      date,
      title,
      description,
      startsAt,
      endsAt,
      brandColor,
      hallId,
      hall,
    } = dto;

    let finalHallId = hallId;

   // existing hall

    if (hallId) {
    const existingHall = await this.prisma.hall.findUnique({
      where: {
      id: hallId},
});

if (!existingHall) {
throw new NotFoundException('Hall not found');
}

// Check if another event already uses this hall
// during the same time.
if (endsAt) {
const conflictingEvent =
 await this.prisma.event.findFirst({
 where: {
 hallId,
 startsAt: {
 lt: endsAt,
},
endsAt: {
gt: startsAt},
},
});

if (conflictingEvent) {
 throw new BadRequestException(
'This hall is already booked for this time.',
);
}
}
}

    //create new hall

if (hall) {
      // User cannot select an existing hall
      // and create a new hall at the same time.
if (hallId) {
  throw new BadRequestException(
  'You cannot select an existing hall and create a new hall at the same time.',
  );
  }

const newHall = await this.prisma.hall.create({
data: {
name: hall.name,
address: hall.address,
capacity: hall.capacity,
description: hall.description,

// Hall requires an organizerId
organizerId,
},
});

finalHallId = newHall.id;}

//uploading event logo

let logoUrl = dto.logoUrl;

if (file) {
  logoUrl =
  await this.supabaseService.uploadEventBanner(file)}

    //create event

    const event = await this.prisma.event.create({
      data: {
        date,
        description,
        title,
        startsAt,
        endsAt,
        logoUrl,
        brandColor,
        organizerId,
        hallId: finalHallId ?? null,
      },

      include: {
        organizer: true,
        hall: true,
      },
    });

    return {
      ...event,
      registrationLink: `${process.env.FRONTEND_URL}/register/${event.publicRegistrationToken}`,
    };
  }

  //get all the events

  async findAll(organizerId: string) {
      console.log('🔥 CURRENT ADMIN ID:', organizerId);
      const events = await this.prisma.event.findMany({
      where: {
        organizerId,
      },
      orderBy: {date: 'asc'},
include: {organizer: {select: {
            id: true,
            name: true,
            email: true},
},
hall: true,
_count: {select: {attendees: true}},
      },
    });
     console.log('🔥🔥🔥 NUMBER OF EVENTS:', events.length);
    return events;
  }

 //get one event

  async findOne(id: string,  organizerId?: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
         ...(organizerId && { organizerId }),
      },

      include: {
        organizer: true,
        hall: true,
      },
    });

    if (!event) {
      throw new NotFoundException(
        `Event with id ${id} not found`,
      );
    }

    return event;
  }

 //update event

  async update(id: string,updateEventDto: UpdateEventDto,organizerId: string,) {
  const event = await this.findOne(id);

  if (event.organizerId !== organizerId) {
    throw new ForbiddenException(
      'You do not have permission to update this event',
    );
  }

  const {
    date,
    hallId,
    hall: _hall,
    ...eventFields
  } = updateEventDto;

  return this.prisma.event.update({
    where: {
      id,
    },

    data: {
      ...eventFields,

      ...(date !== undefined && {
        date,
      }),

      ...(hallId !== undefined && {
        hall: {
          connect: {
            id: hallId,
          },
        },
      }),
    },

    include: {
      organizer: true,
      hall: true,
    },
  });
}

  // delete events

  async remove(id: string,organizerId: string,) {
    const event = await this.findOne(id);

    if (event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'You do not have permission to delete this event',
      );
    }

    return this.prisma.event.delete({
      where: {
        id,
      },
    });
  }

  //assign existing hall

  async assignHall(eventId: string,hallId: string, organizerId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId, organizerId,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const hall = await this.prisma.hall.findFirst({
      where: {
        id: hallId,organizerId,
      },
    });

    if (!hall) {
      throw new NotFoundException('Hall not found or do not permission to use this hall');
    }

    // Check for scheduling conflict
    if (event.endsAt) {
      const conflictingEvent =
        await this.prisma.event.findFirst({
          where: {
            hallId,
id: {not: eventId},
startsAt: {lt: event.endsAt},
endsAt: {gt: event.startsAt},
          },
        });

      if (conflictingEvent) {
        throw new BadRequestException(
          'This hall is already booked for this time.',
        );
      }
    }

    return this.prisma.event.update({
      where: {
        id: eventId,
      },

      data: {
        hallId,
      },

      include: {
        hall: true,
      },
    });
  }


  async getPublicEvent(token: string) {
  const event = await this.prisma.event.findUnique({
    where: {
      publicRegistrationToken: token,
    },
    include: {
      hall: true,
    },
  });

  if (!event) {
    throw new NotFoundException('Event not found');
  }

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    logoUrl: event.logoUrl,
    brandColor: event.brandColor,
    hall: event.hall
      ? {
          name: event.hall.name,
          address: event.hall.address,
        }
      : null,
  };
}

async createAttendee(
  token: string,
  dto: CreateAttendeeDto,
) {
  const event = await this.prisma.event.findUnique({
    where: {
      publicRegistrationToken: token,
    },
    include: {
      hall: true,
    },
  });

  if (!event) {
    throw new NotFoundException('Event not found');
  }

  if (!event.hall) {
    throw new BadRequestException(
      'Registration is not available because no hall has been assigned to this event',
    );
  }

  const existingAttendee =
    await this.prisma.attendee.findUnique({
      where: {
        eventId_email: {
          eventId: event.id,
          email: dto.email,
        },
      },
    });

  if (existingAttendee) {

    throw new BadRequestException(
      'This email is already registered for this event',
    );
  }

  const attendee = await this.prisma.attendee.create({
    data: {
      eventId: event.id,
      name: dto.name,
      email: dto.email,
    },
  });

  const pass = await this.passesService.createPass(attendee.id);

  return {
    message: 'Registration successful. Your event pass has been sent to your email.',
    attendeeId: attendee.id,
    passId: pass.passId,
  };
}
}

