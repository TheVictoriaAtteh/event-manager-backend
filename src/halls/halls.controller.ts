import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { HallsService } from './halls.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('halls')
@ApiBearerAuth()
@Controller('halls')
export class HallsController {
constructor(private readonly hallsService: HallsService) {}

@Post()
  @Roles(UserRole.ADMIN)
  create(@Body() CreatehallDto: CreateHallDto, @CurrentUser() user: RequestUser) {
    return this.hallsService.create(CreatehallDto, user.id);
  }

  @Get()
  findAll() {
    return this.hallsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hallsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() UpdatehallDtodto: UpdateHallDto) {
    return this.hallsService.update(id, UpdatehallDtodto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.hallsService.remove(id);
  }
}
