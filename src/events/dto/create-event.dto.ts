import { IsString, IsDateString, IsOptional, IsInt} from 'class-validator';

export class CreateEventDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsDateString()
  date!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsString()
  location!: string;

  @IsString()
  logoUrl: string;

  @IsString()
  brandColor?: string;

  @IsInt()
  capacity!: number;

  @IsOptional()
  hallId?: string;
  
}