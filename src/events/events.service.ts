import {BadRequestException, ForbiddenException,Injectable,NotFoundException} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { SupabaseService } from '../auth/supabase.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
@Injectable()
export class EventsService {

  constructor(private prisma: PrismaService,private  supabaseService: SupabaseService) {}

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
  const now = new Date();
  const event = await this.prisma.event.findUnique({
    where: {
      publicRegistrationToken: token,
    },
    include: {
      hall: true,
      ticketTypes: {
        where: {
          isActive: true,
          AND: [
            { OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: now } }] },
            { OR: [{ saleEndsAt: null }, { saleEndsAt: { gte: now } }] },
          ],
        },
        orderBy: { priceMinor: 'asc' },
      },
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
    ticketTypes: event.ticketTypes.map((ticketType) => ({
      id: ticketType.id,
      name: ticketType.name,
      description: ticketType.description,
      priceMinor: ticketType.priceMinor,
      currency: ticketType.currency,
      availableQuantity:
        ticketType.quantity === null
          ? null
          : Math.max(
              0,
              ticketType.quantity -
                ticketType.soldCount -
                ticketType.reservedCount,
            ),
    })),
    hall: event.hall
      ? {
          name: event.hall.name,
          address: event.hall.address,
        }
      : null,
  };
}

  async listTicketTypes(eventId: string, organizerId: string) {
    await this.findOne(eventId, organizerId);
    return this.prisma.ticketType.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createTicketType(
    eventId: string,
    dto: CreateTicketTypeDto,
    organizerId: string,
  ) {
    await this.findOne(eventId, organizerId);
    this.validateSaleWindow(dto.saleStartsAt, dto.saleEndsAt);
    return this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name.trim(),
        description: dto.description,
        priceMinor: dto.priceMinor,
        currency: dto.currency ?? 'NGN',
        quantity: dto.quantity,
        isActive: dto.isActive ?? true,
        saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null,
        saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null,
      },
    });
  }

  async updateTicketType(
    eventId: string,
    ticketTypeId: string,
    dto: UpdateTicketTypeDto,
    organizerId: string,
  ) {
    await this.findOne(eventId, organizerId);
    const ticketType = await this.prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
    });
    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    const saleStartsAt = dto.saleStartsAt === undefined
      ? ticketType.saleStartsAt
      : dto.saleStartsAt
        ? new Date(dto.saleStartsAt)
        : null;
    const saleEndsAt = dto.saleEndsAt === undefined
      ? ticketType.saleEndsAt
      : dto.saleEndsAt
        ? new Date(dto.saleEndsAt)
        : null;
    this.validateSaleWindow(
      saleStartsAt?.toISOString(),
      saleEndsAt?.toISOString(),
    );

    if (
      dto.quantity !== undefined &&
      dto.quantity !== null &&
      dto.quantity < ticketType.soldCount + ticketType.reservedCount
    ) {
      throw new BadRequestException(
        'Quantity cannot be lower than tickets already sold or reserved',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.quantity !== undefined && dto.quantity !== null) {
        const updated = await tx.$executeRaw`
          UPDATE "ticket_types"
          SET "quantity" = ${dto.quantity}
          WHERE "id" = ${ticketType.id}
            AND ${dto.quantity} >= "soldCount" + "reservedCount"
        `;
        if (updated !== 1) {
          throw new BadRequestException(
            'Quantity cannot be lower than tickets already sold or reserved',
          );
        }
      } else if (dto.quantity === null) {
        await tx.ticketType.update({
          where: { id: ticketType.id },
          data: { quantity: null },
        });
      }
      return tx.ticketType.update({
        where: { id: ticketType.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.priceMinor !== undefined && { priceMinor: dto.priceMinor }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.saleStartsAt !== undefined && {
            saleStartsAt: dto.saleStartsAt ? new Date(dto.saleStartsAt) : null,
          }),
          ...(dto.saleEndsAt !== undefined && {
            saleEndsAt: dto.saleEndsAt ? new Date(dto.saleEndsAt) : null,
          }),
        },
      });
    });
  }

  async deactivateTicketType(
    eventId: string,
    ticketTypeId: string,
    organizerId: string,
  ) {
    await this.findOne(eventId, organizerId);
    const result = await this.prisma.ticketType.updateMany({
      where: { id: ticketTypeId, eventId },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new NotFoundException('Ticket type not found');
    }
    return { message: 'Ticket type deactivated' };
  }

  private validateSaleWindow(
    startsAt?: string | null,
    endsAt?: string | null,
  ) {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      throw new BadRequestException('Sale end must be after sale start');
    }
  }
}
