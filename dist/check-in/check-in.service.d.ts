import { PrismaService } from '../database/prisma.service';
export interface CheckInResult {
    success: boolean;
    message: string;
    checkIn: {
        id: string;
        scannedAt: Date;
        attendee: {
            id: string;
            name: string;
            email: string;
            passType: string;
        };
        event: {
            id: string;
            title: string;
        };
        scannedBy: {
            id: string;
            name: string;
            email: string;
        } | null;
    };
}
export interface CheckInLogRecord {
    id: string;
    scannedAt: Date;
    passId: string;
    attendee: {
        id: string;
        name: string;
        email: string;
        passType: string;
    };
    scannedBy: {
        id: string;
        name: string;
        email: string;
    } | null;
}
export declare class CheckInService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    scanPass(passId: string, scannedById: string): Promise<CheckInResult>;
    getEventCheckIns(eventId: string, userId: string): Promise<CheckInLogRecord[]>;
}
