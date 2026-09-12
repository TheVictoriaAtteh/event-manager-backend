import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyPassDto {
  @IsString()
  @IsNotEmpty()
  qrToken: string;
}