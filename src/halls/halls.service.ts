import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';


@Injectable()
export class HallsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateHallDto, organizerId: string) {

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
        organizerId,
      },
    });
  }

  async findAll(organizerId: string) {
    return this.prisma.hall.findMany({
      where: { organizerId },
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
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    if (hall.organizerId !== ownerId) {
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
    });

    if (!hall) {
      throw new NotFoundException('Hall not found');
    }

    if (hall.organizerId !== ownerId) {
      throw new ForbiddenException('You are not authorized to delete this hall');
    }

    return this.prisma.hall.delete({
      where: { id },
    });
  }
}