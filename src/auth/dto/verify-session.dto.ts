import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';


export class VerifySessionDto {
  @ApiProperty({
    description: 'Supabase access_token from the confirmation link hash',
  })
  @IsString()
  @MinLength(1)
  accessToken: string;

  @ApiProperty({
    description: 'Supabase refresh_token from the confirmation link hash',
  })
  @IsString()
  @MinLength(1)
  refreshToken: string;
}
