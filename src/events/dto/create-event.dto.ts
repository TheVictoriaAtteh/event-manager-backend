import {
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({
    example: 'Tech Conference 2026',
    description: 'The title of the event',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    example: 'A technology conference for developers and innovators.',
    description: 'Description of the event',
  })
  @IsString()
  description!: string;

  @ApiProperty({
    example: '2026-10-15',
    description: 'Date of the event',
  })
  @IsDateString()
  date!: string;

  @ApiProperty({
    example: '10:00',
    description: 'Event start time',
  })
  @IsString()
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
    description: 'URL of the event banner/logo',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: '#1E40AF',
    description: 'Brand color for the event',
  })
  @IsOptional()
  @IsString()
  brandColor?: string;

  @ApiPropertyOptional({
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    description: 'ID of the hall assigned to the event',
  })
  @IsOptional()
  @IsString()
  hallId?: string;
}