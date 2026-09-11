import { Strategy } from 'passport-jwt';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly usersService;
    constructor(usersService: UsersService);
    validate(payload: {
        sub: string;
        email?: string;
        exp?: number;
        role?: string;
    }): Promise<RequestUser>;
}
export {};
