import type { Request } from 'express';
import { type RequestUser } from '../common/decorators/current-user.decorator';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { QueryAttendeesDto } from './dto/query-attendees.dto';
export declare class AttendeesController {
    private readonly attendeesService;
    constructor(attendeesService: AttendeesService);
    create(eventId: string, dto: CreateAttendeeDto, user: RequestUser): Promise<import("./attendees.service").AttendeeWithRelations>;
    findAll(eventId: string, query: QueryAttendeesDto, user: RequestUser): Promise<{
        data: import("./attendees.service").AttendeeWithRelations[];
        total: number;
    }>;
    importCsv(eventId: string, user: RequestUser, request: Request): Promise<import("./attendees.service").CsvImportResult>;
    findOne(id: string, user: RequestUser): Promise<import("./attendees.service").AttendeeWithRelations>;
    update(id: string, dto: UpdateAttendeeDto, user: RequestUser): Promise<import("./attendees.service").AttendeeWithRelations>;
    remove(id: string, user: RequestUser): Promise<void>;
}
