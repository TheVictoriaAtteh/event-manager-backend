import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTicketTypeDto {
  @ApiProperty({ example: 'VIP' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Includes reserved seating.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 250000, description: 'Price in the currency minor unit (e.g. kobo).' })
  @IsInt()
  @Min(1)
  priceMinor!: number;

  @ApiPropertyOptional({ example: 'NGN', default: 'NGN' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ApiPropertyOptional({ example: 100, nullable: true, description: 'Omit or use null for unlimited stock.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiPropertyOptional({ example: '2026-10-25T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;
}
