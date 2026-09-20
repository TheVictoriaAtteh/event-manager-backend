import {
  IsString,
  IsDateString,
  IsOptional,
  IsUUID,
  IsInt,
  IsNotEmpty,
  Min,
  ValidateNested,
} from 'class-validator';

import { Type } from 'class-transformer';

import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateHallInlineDto {
  @ApiProperty({
    example: 'International Conference Centre',
    description: 'Name of the new hall',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example: 'Central Area, Abuja',
    description: 'Address of the new hall',
  })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @ApiProperty({
    example: 1000,
    description: 'Maximum capacity of the hall',
  })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiPropertyOptional({
    example: 'Main conference venue',
    description: 'Optional description of the hall',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateEventDto {
  @ApiProperty({
    example: 'Tech Conference 2026',
    description: 'The title of the event',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example: 'A technology conference for developers and innovators.',
    description: 'Description of the event',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({
    example: '2026-10-25',
    description: 'Date of the event',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: '10:00',
    description: 'Event start time',
  })
  @IsString()
  @IsNotEmpty()
  startsAt!: string;

  @ApiPropertyOptional({
    example: '16:00',
    description: 'Event end time',
  })
  @IsOptional()
  @IsString()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/event-banner.jpg',
    description: 'URL of event banner/logo',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: '#1E40AF',
    description: 'Brand color for event',
  })
  @IsOptional()
  @IsString()
  brandColor?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    description: 'ID of an existing hall',
  })
  @IsOptional()
  @IsUUID()
  hallId?: string;

  @ApiPropertyOptional({
    type: CreateHallInlineDto,
    description: 'Create a new hall while creating the event',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateHallInlineDto)
  hall?: CreateHallInlineDto;
}