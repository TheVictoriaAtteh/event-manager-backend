import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Carries the Supabase session tokens that the user's browser received
 * directly in the confirmation-link URL hash (implicit flow, "already
 * signed in" variant). The backend validates the access_token and, on
 * success, issues the application's own JWT.
 */
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