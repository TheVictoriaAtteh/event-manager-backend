import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      capacity,
    } = dto

    return this.prisma.hall.create({
      data: {
        name,
        address,
        capacity,
        organization: {
        connect: { id: organization.id },
      },
      },
    });
  }

async findAll() {
    return this.prisma.hall.findMany();
    
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

  async update(id: string, updateHallDto: UpdateHallDto) {
    await this.findOne(id);

    return this.prisma.hall.update({
      where: { id },
      data: updateHallDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.hall.delete({
      where: { id },
    });
  }
}