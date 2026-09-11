import { type RequestUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    me(user: RequestUser): Promise<{
        supabaseUserId: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        id: string;
        role: import(".prisma/client").$Enums.UserRole;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
