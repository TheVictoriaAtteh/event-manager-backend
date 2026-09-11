import { type RequestUser } from '../common/decorators/current-user.decorator';
import { CheckInService } from './check-in.service';
export declare class CheckInController {
    private readonly checkInService;
    constructor(checkInService: CheckInService);
    scanPass(passId: string, user: RequestUser): Promise<import("./check-in.service").CheckInResult>;
    getEventCheckIns(eventId: string, user: RequestUser): Promise<import("./check-in.service").CheckInLogRecord[]>;
}
