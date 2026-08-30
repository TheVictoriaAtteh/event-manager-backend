import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { HallsService } from './halls.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';

@Controller('halls')
export class HallsController {
constructor(private readonly hallsService: HallsService) {}

@Post()
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
  update(@Param('id') id: string, @Body() UpdatehallDtodto: UpdateHallDto) {
    return this.hallsService.update(id, UpdatehallDtodto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hallsService.remove(id);
  }
}
