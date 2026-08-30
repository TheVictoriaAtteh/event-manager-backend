import { IsUUID } from 'class-validator';

export class AssignHallDto {
  @IsUUID()
  hallId!: string;
}