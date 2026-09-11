import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
export declare class EventsService {
    private prisma;
    supabaseService: any;
    constructor(prisma: PrismaService);
    create(dto: CreateEventDto, organizerId: string): Promise<{
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
    update(id: string, updateEventDto: UpdateEventDto, organizerId: string): Promise<{
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
    remove(id: string, organizerId: string): Promise<{
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
    assignHall(eventId: string, hallId: string): Promise<{
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
