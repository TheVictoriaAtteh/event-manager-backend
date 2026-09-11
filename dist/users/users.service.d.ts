import { UserRole, type User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SyncUserDto } from './dto/sync-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createOrUpdate(dto: SyncUserDto, role?: UserRole): Promise<User>;
    ensureOrganization(user: User): Promise<void>;
    findById(id: string): Promise<User | null>;
    findBySupabaseUserId(supabaseUserId: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
}
