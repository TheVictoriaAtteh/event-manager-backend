import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignHallDto } from './dto/assign-hall.dto';
import { type RequestUser } from '../common/decorators/current-user.decorator';
export declare class EventsController {
    private readonly eventsService;
    constructor(eventsService: EventsService);
    create(createEventDto: CreateEventDto, user: RequestUser): Promise<{
        hall: {
            description: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            organizerId: string;
            capacity: number;
        } | null;
        organizer: {
            supabaseUserId: string;
            email: string;
            name: string;
            avatarUrl: string | null;
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    }>;
    findAll(): Promise<({
        hall: {
            description: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            organizerId: string;
            capacity: number;
        } | null;
        _count: {
            attendees: number;
        };
        organizer: {
            email: string;
            name: string;
            id: string;
        };
    } & {
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    })[]>;
    findOne(id: string): Promise<{
        hall: {
            description: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            organizerId: string;
            capacity: number;
        } | null;
        organizer: {
            supabaseUserId: string;
            email: string;
            name: string;
            avatarUrl: string | null;
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    }>;
    update(id: string, updateEventDto: UpdateEventDto, user: RequestUser): Promise<{
        hall: {
            description: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            organizerId: string;
            capacity: number;
        } | null;
        organizer: {
            supabaseUserId: string;
            email: string;
            name: string;
            avatarUrl: string | null;
            id: string;
            role: import(".prisma/client").$Enums.UserRole;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    }>;
    remove(id: string, user: RequestUser): Promise<{
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    }>;
    assignHall(id: string, assignHallDto: AssignHallDto): Promise<{
        hall: {
            description: string | null;
            name: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            address: string | null;
            organizerId: string;
            capacity: number;
        } | null;
    } & {
        description: string;
        title: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        logoUrl: string | null;
        brandColor: string | null;
        date: string;
        startsAt: string;
        endsAt: string | null;
        hallId: string | null;
        organizerId: string;
        publicRegistrationEnabled: boolean;
        category: string | null;
    }>;
}
