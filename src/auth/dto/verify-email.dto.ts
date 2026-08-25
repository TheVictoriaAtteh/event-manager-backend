import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Accepts the credential carried by a Supabase verification link:
 * - `tokenHash` (or legacy `token` + `email`) for the implicit flow —
 *   checked via Supabase `verifyOtp`;
 * - `code` for the PKCE flow — exchanged via Supabase.
 *
 * "At least one credential present" is enforced by AuthService.
 */
export class VerifyEmailDto {
  @ApiPropertyOptional({
    description: 'Required when using the legacy 6-digit token',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'PKCE code from the verification link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiPropertyOptional({ description: 'token_hash from the verification link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  tokenHash?: string;

  @ApiPropertyOptional({ description: 'Legacy token from the verification link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  token?: string;

  @ApiPropertyOptional({
    enum: ['signup', 'invite', 'email_change'],
    default: 'signup',
  })
  @IsOptional()
  @IsIn(['signup', 'invite', 'email_change'])
  type?: 'signup' | 'invite' | 'email_change';
}
