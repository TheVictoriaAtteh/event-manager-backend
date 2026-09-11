import { HallsService } from './halls.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { type RequestUser } from '../common/decorators/current-user.decorator';
export declare class HallsController {
    private readonly hallsService;
    constructor(hallsService: HallsService);
    create(CreatehallDto: CreateHallDto, user: RequestUser): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
    findAll(user: RequestUser): Promise<({
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
    update(id: string, UpdatehallDtodto: UpdateHallDto, user: RequestUser): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        address: string | null;
        organizerId: string;
        capacity: number;
    }>;
    remove(id: string, user: RequestUser): Promise<{
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
