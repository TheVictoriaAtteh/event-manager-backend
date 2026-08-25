import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() supabaseUserId: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty() role: string;
  @ApiPropertyOptional({ nullable: true }) avatarUrl?: string | null;
  @ApiProperty() createdAt: Date;
}

export class RegisterResponseDto {
  @ApiProperty({ example: 'Registration successful. Please verify your email.' })
  message: string;

  @ApiProperty({
    description:
      'True when the user must confirm their email before signing in',
  })
  emailVerificationRequired: boolean;

  @ApiPropertyOptional({
    description:
      'Present only when the account was confirmed immediately (email confirmation disabled in Supabase)',
  })
  accessToken?: string;

  @ApiPropertyOptional({ type: AuthUserDto })
  user?: AuthUserDto;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT issued by this API (use as Bearer token)' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ description: 'Token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({
    description: 'Supabase refresh token for POST /auth/refresh',
  })
  refreshToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}

export class MessageResponseDto {
  @ApiProperty() message: string;
}

export class VerifyEmailResponseDto {
  @ApiProperty({ example: true }) verified: boolean;
  @ApiProperty() message: string;
  @ApiPropertyOptional({ type: AuthUserDto }) user?: AuthUserDto;
}
