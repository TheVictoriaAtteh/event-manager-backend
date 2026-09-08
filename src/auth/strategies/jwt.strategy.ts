import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { RequestUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../../users/users.service';

/**
 * Supabase Auth signs access tokens with ES256 (ECC P-256). The public key
 * below is pinned from the project JWKS endpoint:
 * https://rmwdzialscblstjaixoo.supabase.co/auth/v1/.well-known/jwks.json
 * SUPABASE_JWT_SECRET (HS256) is intentionally NOT used for verification.
 */
const SUPABASE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAwXeZOrLjj8q0ZlHtV8MfjXZERbJ
FrM7WfX2TJly3pfC3ySnFLRctCkvPIxw4LX7ibgskqRhQa78ofu58BC7hA==
-----END PUBLIC KEY-----`;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: SUPABASE_PUBLIC_KEY,
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