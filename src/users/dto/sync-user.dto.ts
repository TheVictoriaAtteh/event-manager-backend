import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

/**
 * Data used to create/update the local mirror of a Supabase Auth user.
 * Credentials are NEVER part of this DTO — Supabase Auth owns them.
 */
export class SyncUserDto {
  @ApiProperty({ description: 'Supabase Auth user id (uuid)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  supabaseUserId: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Profile picture URL (Supabase metadata)' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
