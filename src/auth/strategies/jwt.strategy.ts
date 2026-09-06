import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
      algorithms: ['ES256'],
    });
  }

  async validate(payload: {
    sub: string;
    email?: string;
    exp?: number;
    role?: string;
  }): Promise<RequestUser> {
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