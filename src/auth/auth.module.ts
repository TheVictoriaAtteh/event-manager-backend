import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule is intentionally NOT imported here.
    // Token signing has been removed — we return Supabase-issued tokens directly.
    // Token validation is handled by passport-jwt in JwtStrategy using SUPABASE_JWT_SECRET.
  ],
  controllers: [AuthController],
  providers: [AuthService, SupabaseService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
