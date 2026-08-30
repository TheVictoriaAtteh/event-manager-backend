import { IsString, IsNotEmpty, IsInt} from 'class-validator';

export class CreateHallDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
  
  @IsInt()
  capacity!: number;
}