import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';


@Injectable()
export class HallsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHallDto, ownerId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { ownerId },
      select: { id: true },
    });

    if (!organization) {
      throw new BadRequestException('User does not own an organization');
    }

    const {
      name,
      address,
      description,
      capacity,
    } = dto

    return this.prisma.hall.create({
      data: {
        name,
        address,
        description,
        capacity,
        organization: {
          connect: { id: organization.id },
        },
      },
    });
  }

  async findAll(ownerId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { ownerId },
      select: { id: true },
    });

    if (!organization) {
      return [];
    }

    return this.prisma.hall.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { events: true } },
      },
    });
  }

  async findOne(id: string) {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    return hall;
  }

  async update(id: string, updateHallDto: UpdateHallDto, ownerId: string) {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
      include: { organization: { select: { ownerId: true } } },
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    if (hall.organization.ownerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to modify this hall');
    }

    return this.prisma.hall.update({
      where: { id },
      data: updateHallDto,
    });
  }

  async remove(id: string, ownerId: string) {
    const hall = await this.prisma.hall.findUnique({
      where: { id },
      include: { organization: { select: { ownerId: true } } },
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    if (hall.organization.ownerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to delete this hall');
    }

    return this.prisma.hall.delete({
      where: { id },
    });
  }
}