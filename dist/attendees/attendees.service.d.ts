import { type Attendee } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { QueryAttendeesDto } from './dto/query-attendees.dto';
export interface LatestPass {
    id: string;
    revokedAt: Date | null;
}
export interface AttendeeWithRelations extends Attendee {
    pass: LatestPass | null;
    checkIn: {
        scannedAt: Date;
    } | null;
}
export interface CsvImportResult {
    totalRows: number;
    created: number;
    duplicates: number;
    errors: {
        rowNumber: number;
        message: string;
    }[];
    message: string;
}
export declare class AttendeesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private assertEventOwner;
    private assertAttendeeAccess;
    private issuePass;
    create(eventId: string, dto: CreateAttendeeDto, userId: string): Promise<AttendeeWithRelations>;
    findAll(eventId: string, userId: string, query: QueryAttendeesDto): Promise<{
        data: AttendeeWithRelations[];
        total: number;
    }>;
    findOne(id: string, userId: string): Promise<AttendeeWithRelations>;
    update(id: string, dto: UpdateAttendeeDto, userId: string): Promise<AttendeeWithRelations>;
    remove(id: string, userId: string): Promise<void>;
    importCsv(eventId: string, userId: string, buffer: Buffer): Promise<CsvImportResult>;
    private toWithRelations;
}
