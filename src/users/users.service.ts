import { Injectable } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SyncUserDto } from './dto/sync-user.dto';

/**
 * Maintains the application-side mirror of Supabase Auth users.
 * Supabase Auth is the source of truth for credentials; this service only
 * stores profile/role data and the unique link to the Supabase identity.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts the local user record for a Supabase Auth user
   * (keyed by `supabaseUserId`). The role is only applied when the record
   * is first created — it is never overwritten by later syncs.
   */
  async createOrUpdate(dto: SyncUserDto, role?: UserRole): Promise<User> {
    return this.prisma.user.upsert({
      where: { supabaseUserId: dto.supabaseUserId },
      update: {
        email: dto.email.toLowerCase(),
        name: dto.name,
        avatarUrl: dto.avatarUrl ?? null,
      },
      create: {
        supabaseUserId: dto.supabaseUserId,
        email: dto.email.toLowerCase(),
        name: dto.name,
        avatarUrl: dto.avatarUrl ?? null,
        ...(role ? { role } : {}),
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findBySupabaseUserId(supabaseUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { supabaseUserId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }
}
