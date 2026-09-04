import { Injectable } from '@nestjs/common';
import { UserRole, type User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SyncUserDto } from './dto/sync-user.dto';


@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  
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

  /**
   * Ensures the user owns at least one Organization.
   * Creates a default Organization on first login so that event and hall
   * creation (which both require an Organization) work immediately.
   * Safe to call on every login — the DB query is a cheap indexed lookup.
   */
  async ensureOrganization(user: User): Promise<void> {
    const existing = await this.prisma.organization.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.organization.create({
        data: {
          name: `${user.name}'s Organization`,
          ownerId: user.id,
        },
      });
    }
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
