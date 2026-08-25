import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Accepts the credential carried by the Supabase "recovery" email link
 * (`tokenHash`/legacy `token`+`email` for the implicit flow, `code` for
 * PKCE) plus the new password.
 *
 * "At least one credential present" is enforced by AuthService.
 */
export class ResetPasswordDto {
  @ApiPropertyOptional({
    description: 'Required when using the legacy 6-digit token',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'PKCE code from the reset link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @ApiPropertyOptional({ description: 'token_hash from the reset link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  tokenHash?: string;

  @ApiPropertyOptional({ description: 'Legacy token from the reset link' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  token?: string;

  @ApiProperty({ example: 'N3w!password', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72)
  newPassword: string;
}
