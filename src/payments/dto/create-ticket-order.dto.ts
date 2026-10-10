import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TicketAttendeeDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class CreateTicketOrderDto {
  @ApiProperty({ description: 'ID of a ticket type offered by this event.' })
  @IsUUID()
  ticketTypeId!: string;

  @ApiPropertyOptional({
    type: [TicketAttendeeDto],
    description: 'One attendee per ticket; maximum 10 tickets per checkout.',
    minItems: 1,
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => TicketAttendeeDto)
  attendees?: TicketAttendeeDto[];

  @ApiPropertyOptional({
    example: 'Jane Doe',
    description: 'Legacy single-ticket name; use attendees for multi-ticket orders.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'jane.doe@example.com',
    description: 'Legacy single-ticket email; use attendees for multi-ticket orders.',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
