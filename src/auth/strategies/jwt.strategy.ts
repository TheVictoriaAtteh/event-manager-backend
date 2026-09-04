import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

/**
 * Validates Supabase-issued access tokens.
 *
 * The token is signed by Supabase using the project's JWT secret
 * (Supabase dashboard → Settings → API → JWT Settings → JWT Secret).
 * We no longer issue our own JWTs — we validate the same token Supabase
 * hands to the user on login/register. This means:
 * - No per-developer JWT_SECRET dependency
 * - Tokens work correctly on every deployment
 * - One indexed DB lookup per request to hydrate the local user record
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('SUPABASE_JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    exp?: number;
    role?: string;
  }): Promise<RequestUser> {
    // Supabase 'sub' claim is the Supabase user UUID
    const user = await this.usersService.findBySupabaseUserId(payload.sub);

    if (!user) {
      throw new UnauthorizedException({
        message: 'User account not found',
        code: 'USER_NOT_FOUND',
      });
    }

    return {
      id: user.id,
      supabaseUserId: user.supabaseUserId,
      email: user.email,
      role: user.role,
      name: user.name,
    };
  }
}
