import { IsString, IsNotEmpty, IsInt, IsOptional } from 'class-validator';

export class CreateHallDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;
  
  @IsInt()
  capacity!: number;
}