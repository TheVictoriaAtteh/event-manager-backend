import { IsString, IsDateString, IsOptional, IsInt } from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsDateString()
  date!: string;

  @IsString()
  startsAt!: string;

  @IsString()
  endsAt?: string;
  
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;

  @IsOptional()
  @IsString()
  hallId?: string;
}