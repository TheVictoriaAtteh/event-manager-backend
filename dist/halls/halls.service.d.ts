import { PrismaService } from '../database/prisma.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
export declare class HallsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateHallDto, organizerId: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
    findAll(organizerId: string): Promise<({
        _count: {
            events: number;
        };
    } & {
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    })[]>;
    findOne(id: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
    update(id: string, updateHallDto: UpdateHallDto, ownerId: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
    remove(id: string, ownerId: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
}
