import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, type RequestUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AttendeesService } from './attendees.service';
import { CreateAttendeeDto } from './dto/create-attendee.dto';
import { UpdateAttendeeDto } from './dto/update-attendee.dto';
import { QueryAttendeesDto } from './dto/query-attendees.dto';

// Uploaded file shape from multer (memory storage). @types/multer is not
// installed, so we type the Express.Multer.File structurally.
interface UploadedFile {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
  fieldname?: string;
}

@ApiTags('attendees')
@ApiBearerAuth()
@Controller()
export class AttendeesController {
  constructor(private readonly attendeesService: AttendeesService) {}

  @Post('events/:eventId/attendees')
  @ApiOperation({ summary: 'Add an attendee and issue their QR pass' })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateAttendeeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendeesService.create(eventId, dto, user.id);
  }

  @Get('events/:eventId/attendees')
  @ApiOperation({ summary: 'List attendees for an event (search, filter, paginated)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'passType', required: false })
  @ApiQuery({ name: 'take', required: false })
  @ApiQuery({ name: 'skip', required: false })
  findAll(
    @Param('eventId') eventId: string,
    @Query() query: QueryAttendeesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendeesService.findAll(eventId, user.id, query);
  }

  @Post('events/:eventId/attendees/import')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Bulk-import attendees from a CSV file (ADMIN only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async importCsv(
    @Param('eventId') eventId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    const file = (request as Request & { file?: UploadedFile }).file;
    if (!file) {
      throw new BadRequestException('CSV file is required (multipart field "file")');
    }
    return this.attendeesService.importCsv(eventId, user.id, file.buffer);
  }

  @Get('attendees/:id')
  @ApiOperation({ summary: 'Get a single attendee with pass + check-in info' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attendeesService.findOne(id, user.id);
  }

  @Patch('attendees/:id')
  @ApiOperation({ summary: 'Update an attendee; revokes & reissues pass on identity change' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAttendeeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendeesService.update(id, dto, user.id);
  }

  @Delete('attendees/:id')
  @ApiOperation({ summary: 'Remove an attendee and their pass(es)' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attendeesService.remove(id, user.id);
  }
}