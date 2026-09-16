import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { HallsService } from './halls.service';
import { CreateHallDto } from './dto/create-hall.dto';
import { UpdateHallDto } from './dto/update-hall.dto';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';


@ApiTags('halls')
@ApiBearerAuth()
@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Post()
  create(@Body() CreatehallDto: CreateHallDto, @CurrentUser() user: RequestUser) {
    return this.hallsService.create(CreatehallDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user: RequestUser) {
    return this.hallsService.findAll(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hallsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() UpdatehallDtodto: UpdateHallDto, @CurrentUser() user: RequestUser) {
    return this.hallsService.update(id, UpdatehallDtodto, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.hallsService.remove(id, user.id);
  }
}
